"use client";

import {
  useEffect,
  useReducer,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";

import {
  createInitialSession,
  reduceSession,
  type ModelDuelSession,
  type MoonSimulationObservation,
  type SessionAction,
} from "@/lib/modelduel";
import { PRODUCT, SAMPLE_MISCONCEPTION } from "@/lib/product";

import {
  ModelDuelApiError,
  buildTransferRequest,
  evaluateTransfer,
  loadVerifiedDemo,
  submitRevision,
  type AnalysisLoad,
  type RevisionSubmissionRequest,
  type TransferEvaluationRequest,
} from "./client";
import {
  EXPERIENCE_STEPS,
  createStableId,
  experienceStageForSession,
  stageIndex,
  validateExplanation,
  validateRevision,
  validateSketchFile,
} from "./flow";
import { WorldComparison } from "./WorldComparison";
import { useHydrationReady } from "./browser";

type SessionContainer = Readonly<{
  value: ModelDuelSession;
  rejection: string | null;
}>;

function sessionReducer(
  state: SessionContainer,
  action: SessionAction,
): SessionContainer {
  const transition = reduceSession(state.value, action);
  return {
    value: transition.state,
    rejection: transition.accepted ? null : transition.reason,
  };
}

function nextTimestamp(clock: { current: number }) {
  const next = Math.max(Date.now(), clock.current + 1);
  clock.current = next;
  return next;
}

function humanError(error: unknown, fallback: string) {
  return error instanceof ModelDuelApiError || error instanceof Error
    ? error.message
    : fallback;
}

function optionLabel(
  options: ReadonlyArray<Readonly<{ id: string; label: string }>>,
  optionId: string | null | undefined,
) {
  return options.find((option) => option.id === optionId)?.label ?? "Not recorded";
}

function formatReceipt(receiptId: string) {
  return receiptId.length > 24
    ? `${receiptId.slice(0, 12)}…${receiptId.slice(-8)}`
    : receiptId;
}

function SourceNotice({
  load,
}: Readonly<{ load: AnalysisLoad }>) {
  return (
    <aside className="source-notice">
      <span className="source-badge">Verified authored sample</span>
      <p>{load.notice}</p>
      <p>
        This P0 challenge does not analyze your typed explanation or sketch. Your
        explanation and local sketch reference are retained only in this attempt&apos;s trace.
      </p>
    </aside>
  );
}

function ExperienceProgress({
  activeStage,
}: Readonly<{ activeStage: (typeof EXPERIENCE_STEPS)[number]["id"] }>) {
  const activeIndex = stageIndex(activeStage);
  return (
    <nav className="experience-progress" aria-label="Moon challenge progress">
      <ol>
        {EXPERIENCE_STEPS.map((step, index) => (
          <li
            key={step.id}
            className={index < activeIndex ? "complete" : index === activeIndex ? "active" : ""}
            aria-current={index === activeIndex ? "step" : undefined}
          >
            <span className="progress-dot" aria-hidden="true">
              {index < activeIndex ? "✓" : index + 1}
            </span>
            <span>{step.label}</span>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function ModelDuelExperience() {
  const [container, dispatch] = useReducer(
    sessionReducer,
    undefined,
    (): SessionContainer => ({
      value: createInitialSession(createStableId("session")),
      rejection: null,
    }),
  );
  const session = container.value;
  const clock = useRef(0);
  const hydrationReady = useHydrationReady();
  const [explanation, setExplanation] = useState(SAMPLE_MISCONCEPTION);
  const [sketch, setSketch] = useState<Readonly<{ file: File; previewUrl: string }> | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const [sketchError, setSketchError] = useState<string | null>(null);
  const [analysisLoad, setAnalysisLoad] = useState<AnalysisLoad | null>(null);
  const [analysisPending, setAnalysisPending] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [observationReviewed, setObservationReviewed] = useState(false);
  const [revisionDraft, setRevisionDraft] = useState("");
  const [revisionError, setRevisionError] = useState<string | null>(null);
  const [revisionPending, setRevisionPending] = useState(false);
  const [revisionNotice, setRevisionNotice] = useState<string | null>(null);
  const [transferPending, setTransferPending] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    return () => {
      if (sketch) URL.revokeObjectURL(sketch.previewUrl);
    };
  }, [sketch]);

  const stage = experienceStageForSession(session.stage, observationReviewed);
  const analysis = session.analysis;
  const activeStep = stageIndex(stage);
  const moonComparison =
    session.comparison?.learner.scenario === "moon-phases" &&
    session.comparison.scientific.scenario === "moon-phases"
      ? {
          learner: session.comparison.learner as MoonSimulationObservation,
          scientific: session.comparison.scientific as MoonSimulationObservation,
        }
      : null;

  function handleSketch(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const validationError = validateSketchFile(file);
    if (validationError) {
      setSketch(null);
      setSketchError(validationError);
      event.target.value = "";
      return;
    }
    setSketchError(null);
    setSketch({ file, previewUrl: URL.createObjectURL(file) });
  }

  async function requestValidatedChallenge(
    requestId: string,
    sessionId: string,
  ) {
    setStatus("Loading the validated authored Moon challenge.");
    setAnalysisPending(true);
    setAnalysisError(null);

    try {
      const loaded = await loadVerifiedDemo(sessionId);
      setAnalysisLoad(loaded);
      dispatch({
        type: "RECEIVE_ANALYSIS",
        sessionId,
        requestId,
        analysis: loaded.analysis,
        receivedAt: nextTimestamp(clock),
      });
      setStatus("Challenge response received and passed to the protected session.");
    } catch (error) {
      setAnalysisLoad(null);
      setAnalysisError(
        humanError(error, "The validated authored challenge could not be loaded."),
      );
      setStatus("Authored challenge unavailable. No evidence or score was shown.");
    } finally {
      setAnalysisPending(false);
    }
  }

  async function handleCapture(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hydrationReady || analysisPending) return;
    const validationError = validateExplanation(explanation);
    if (validationError) {
      setInputError(validationError);
      return;
    }
    setInputError(null);

    const submittedAt = nextTimestamp(clock);
    const sketchReference = sketch
      ? {
          id: createStableId("sketch"),
          mime: sketch.file.type.replace("image/", "") as "png" | "jpeg" | "webp",
          sizeBytes: sketch.file.size,
        }
      : undefined;
    dispatch({
      type: "START_INPUT",
      scenarioId: "moon-phases",
      explanation,
      sketchReference,
      submittedAt,
    });

    const requestId = createStableId("analysis");
    dispatch({
      type: "BEGIN_ANALYSIS",
      sessionId: session.sessionId,
      requestId,
      startedAt: nextTimestamp(clock),
    });
    await requestValidatedChallenge(requestId, session.sessionId);
  }

  function handleConfirmModels() {
    dispatch({ type: "CONFIRM_MODEL", confirmedAt: nextTimestamp(clock) });
    setStatus("Choose a prediction before any physical evidence is revealed.");
  }

  function handleLockPrediction() {
    if (!session.prediction) return;
    dispatch({ type: "LOCK_PREDICTION", lockedAt: nextTimestamp(clock) });
    setStatus("Prediction locked. It can no longer be changed.");
  }

  function handleRevealEvidence() {
    dispatch({ type: "BEGIN_OBSERVATION", startedAt: nextTimestamp(clock) });
    dispatch({ type: "COMPLETE_OBSERVATION", completedAt: nextTimestamp(clock) });
    setObservationReviewed(false);
    setStatus("Both models ran under the same CaseSpec. Verified evidence is now visible.");
  }

  async function handleRevision(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateRevision(revisionDraft);
    if (validationError) {
      setRevisionError(validationError);
      return;
    }
    if (!session.comparison || !analysis) return;

    setRevisionError(null);
    setRevisionPending(true);
    setRevisionNotice(null);

    let request: RevisionSubmissionRequest;
    if (session.revision && session.revisionEvaluationRequest) {
      request = {
        ...session.revisionEvaluationRequest,
        sessionId: session.sessionId,
        scenarioId: "moon-phases",
        caseFingerprint: session.comparison.caseFingerprint,
        revisionText: session.revision.text,
      };
    } else {
      const submittedAt = nextTimestamp(clock);
      dispatch({ type: "SUBMIT_REVISION", text: revisionDraft, submittedAt });
      const requestId = createStableId("revision");
      const idempotencyKey = createStableId("revision-key");
      const requestedAt = nextTimestamp(clock);
      dispatch({
        type: "BEGIN_REVISION_EVALUATION",
        sessionId: session.sessionId,
        requestId,
        idempotencyKey,
        requestedAt,
      });
      request = {
        requestId,
        idempotencyKey,
        requestedAt,
        sessionId: session.sessionId,
        scenarioId: "moon-phases",
        caseFingerprint: session.comparison.caseFingerprint,
        revisionText: revisionDraft.trim(),
      };
    }

    try {
      const result = await submitRevision(request);
      dispatch({
        type: "RECEIVE_REVISION_FEEDBACK",
        sessionId: session.sessionId,
        requestId: request.requestId,
        feedback: result.feedback,
        evaluatedAt: result.evaluatedAt,
      });
      clock.current = Math.max(clock.current, result.evaluatedAt);
      setRevisionNotice(result.notice);
      setStatus("Revision response received and passed to the protected session.");
    } catch (error) {
      setRevisionError(humanError(error, "The revision could not be checked."));
      setStatus("Revision check failed. No AI feedback was invented.");
    } finally {
      setRevisionPending(false);
    }
  }

  async function handleTransfer() {
    if (!analysis || !session.transfer) return;
    setTransferError(null);
    setTransferPending(true);

    let request: TransferEvaluationRequest;
    if (session.transferEvaluationRequest) {
      request = buildTransferRequest({
        ...session.transferEvaluationRequest,
        sessionId: session.sessionId,
        question: analysis.transferQuestion,
        selectedOptionId: session.transfer.optionId,
      });
    } else {
      const lockedAt = nextTimestamp(clock);
      dispatch({ type: "LOCK_TRANSFER", lockedAt });
      const requestId = createStableId("transfer");
      const idempotencyKey = createStableId("transfer-key");
      const requestedAt = nextTimestamp(clock);
      dispatch({
        type: "BEGIN_TRANSFER_EVALUATION",
        sessionId: session.sessionId,
        requestId,
        idempotencyKey,
        requestedAt,
      });
      request = buildTransferRequest({
        requestId,
        idempotencyKey,
        requestedAt,
        sessionId: session.sessionId,
        question: analysis.transferQuestion,
        selectedOptionId: session.transfer.optionId,
      });
    }

    try {
      const result = await evaluateTransfer(request);
      dispatch({
        type: "RECEIVE_TRANSFER_RESULT",
        sessionId: session.sessionId,
        requestId: request.requestId,
        result,
      });
      clock.current = Math.max(clock.current, result.evaluatedAt);
      setStatus("Transfer response received and passed to the protected session.");
    } catch (error) {
      setTransferError(humanError(error, "The transfer check could not be completed."));
      setStatus("Transfer check failed. No score was inferred in the browser.");
    } finally {
      setTransferPending(false);
    }
  }

  function handleReset() {
    const newSessionId = createStableId("session");
    dispatch({
      type: "RESTART",
      newSessionId,
      restartedAt: nextTimestamp(clock),
    });
    setExplanation(SAMPLE_MISCONCEPTION);
    setSketch(null);
    setInputError(null);
    setSketchError(null);
    setAnalysisLoad(null);
    setAnalysisPending(false);
    setAnalysisError(null);
    setObservationReviewed(false);
    setRevisionDraft("");
    setRevisionError(null);
    setRevisionNotice(null);
    setTransferError(null);
    setTransferPending(false);
    setStatus("New attempt ready.");
  }

  return (
    <>
      <header className="app-header">
        <a className="brand" href="#main-content" aria-label="ModelDuel challenge home">
          <span className="brand-mark" aria-hidden="true">M</span>
          <span>{PRODUCT.name}</span>
        </a>
        <div className="header-meta">
          <span>Education · Moon phases</span>
          {activeStep > 0 ? (
            <button type="button" className="quiet-button" onClick={handleReset}>
              New attempt
            </button>
          ) : null}
        </div>
      </header>

      <ExperienceProgress activeStage={stage} />

      <p className="sr-only" role="status" aria-live="polite">
        {status}
      </p>
      {container.rejection ? (
        <div className="protected-state-error" role="alert">
          <strong>Protected learning state stopped this action.</strong>
          <p>
            The transition was rejected ({container.rejection}). No later evidence or score
            was accepted. Start a new attempt to return to a known state.
          </p>
          <button type="button" className="quiet-button" onClick={handleReset}>
            Start a new attempt
          </button>
        </div>
      ) : null}

      <main id="main-content" className="experience-main">
        {stage === "capture" ? (
          <section className="capture-layout" aria-labelledby="capture-title">
            <div className="capture-copy">
              <p className="eyebrow"><span aria-hidden="true" /> Evidence-led science learning</p>
              <h1 id="capture-title" aria-label={PRODUCT.tagline}>
                <span>Two models predict.</span>
                <span className="gradient-text">Evidence decides.</span>
              </h1>
              <p className="hero-summary">
                Put your Moon-phase idea into words, lock a prediction, then run two
                worlds under exactly the same conditions.
              </p>
              <ul className="promise-list">
                <li>Evidence stays hidden until you commit.</li>
                <li>Physical observation stays separate from model claims.</li>
                <li>Your final transfer result is checked only by the server.</li>
              </ul>
            </div>

            <form
              className="capture-card"
              onSubmit={handleCapture}
              noValidate
              aria-busy={analysisPending}
            >
              <div className="card-heading">
                <div>
                  <p className="micro-label">Capture · step 1 of 7</p>
                  <h2>What causes the Moon&apos;s phases?</h2>
                </div>
                <span className="sample-pill">Editable sample</span>
              </div>
              <label htmlFor="learner-explanation">Your current explanation</label>
              <textarea
                id="learner-explanation"
                value={explanation}
                onChange={(event) => setExplanation(event.target.value)}
                rows={5}
                maxLength={1_500}
                aria-describedby={`explanation-help${inputError ? " explanation-error" : ""}`}
                aria-invalid={Boolean(inputError)}
              />
              <div className="field-meta" id="explanation-help">
                <span>Start with what you currently believe—certainty is not required.</span>
                <span>{explanation.length}/1,500</span>
              </div>
              {inputError ? <p className="field-error" id="explanation-error">{inputError}</p> : null}

              <div className="sketch-field">
                <div>
                  <label htmlFor="learner-sketch">Add a sketch <span>optional</span></label>
                  <p>PNG, JPEG, or WebP · up to 10 MB</p>
                </div>
                <input
                  id="learner-sketch"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleSketch}
                  aria-describedby={sketchError ? "sketch-error" : undefined}
                  aria-invalid={Boolean(sketchError)}
                />
              </div>
              {sketchError ? <p className="field-error" id="sketch-error">{sketchError}</p> : null}
              {sketch ? (
                <div className="sketch-preview">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
                  <img src={sketch.previewUrl} alt="Selected learner sketch preview" />
                  <div>
                    <strong>{sketch.file.name}</strong>
                    <span>This local preview is not analyzed by the authored P0 demo.</span>
                    <button type="button" onClick={() => setSketch(null)}>Remove sketch</button>
                  </div>
                </div>
              ) : null}

              <button
                className="primary-button full-button"
                type="submit"
                disabled={!hydrationReady || analysisPending}
                data-hydrated={hydrationReady ? "true" : "false"}
              >
                {!hydrationReady
                  ? "Preparing challenge…"
                  : analysisPending
                    ? "Loading validated challenge…"
                    : "Build the test"}
                {hydrationReady && !analysisPending ? <span aria-hidden="true">→</span> : null}
              </button>
              <p className="form-disclosure">
                P0 uses a fixed, verified authored challenge. It never presents this sample as
                a live GPT-5.6 analysis of your input.
              </p>
            </form>
          </section>
        ) : null}

        {stage === "interpret" ? (
          <section className="stage-shell" aria-labelledby="interpret-title">
            {analysisPending ? (
              <div className="loading-panel" role="status">
                <span className="loading-orbit" aria-hidden="true" />
                <p className="micro-label">Validating challenge contract</p>
                <h1 id="interpret-title">Preparing two testable worlds…</h1>
                <p>No evidence or answer is revealed during this step.</p>
              </div>
            ) : analysisError || !analysis ? (
              <div className="challenge-error-panel" role="alert">
                <span className="error-orbit" aria-hidden="true">!</span>
                <p className="eyebrow">Validated source required</p>
                <h1 id="interpret-title">Authored challenge unavailable</h1>
                <p>
                  {analysisError ??
                    "The challenge response could not be accepted by the protected session."}
                </p>
                <p>
                  No local sample was substituted. Evidence, revision feedback, transfer
                  scoring, and the final trace remain unavailable.
                </p>
                <button
                  className="primary-button"
                  type="button"
                  disabled={analysisPending || !session.analysisRequestId}
                  onClick={() => {
                    if (session.analysisRequestId) {
                      void requestValidatedChallenge(
                        session.analysisRequestId,
                        session.sessionId,
                      );
                    }
                  }}
                >
                  Retry validated challenge
                </button>
              </div>
            ) : (
              <>
                <header className="stage-heading-block">
                  <p className="eyebrow">Interpret · authored challenge</p>
                  <h1 id="interpret-title">Turn one disagreement into a fair test.</h1>
                  <p>
                    These are competing claims for the same first-quarter Moon case. Review
                    their assumptions before you predict what the test will show.
                  </p>
                </header>
                {analysisLoad ? <SourceNotice load={analysisLoad} /> : null}
                <div className="model-review-grid">
                  <article>
                    <span className="world-letter">A</span>
                    <p className="micro-label">Authored learner model</p>
                    <h2>{analysis.learnerModel.summary}</h2>
                    <ul>
                      {analysis.learnerModel.causalRelations.map((relation) => (
                        <li key={`${relation.subject}-${relation.relation}-${relation.object}`}>
                          {relation.subject} · {relation.relation} · {relation.object}
                        </li>
                      ))}
                    </ul>
                  </article>
                  <div className="versus-chip" aria-hidden="true">VS</div>
                  <article className="science-card">
                    <span className="world-letter">B</span>
                    <p className="micro-label">Scientific challenger</p>
                    <h2>Sunlight illuminates half of the Moon while our viewing angle changes.</h2>
                    <ul>
                      <li>Same Sun, Earth, and Moon</li>
                      <li>Same elongation and orbital latitude</li>
                      <li>Different causal claim</li>
                    </ul>
                  </article>
                </div>
                <div className="stage-action-row">
                  <p><strong>Still hidden:</strong> physical positions, illumination, shadow intersection, and result.</p>
                  <button className="primary-button" type="button" onClick={handleConfirmModels}>
                    Make a prediction <span aria-hidden="true">→</span>
                  </button>
                </div>
              </>
            )}
          </section>
        ) : null}

        {stage === "predict" && analysis ? (
          <section className="narrow-stage" aria-labelledby="predict-title">
            <header className="stage-heading-block">
              <p className="eyebrow">Predict · evidence sealed</p>
              <h1 id="predict-title">Commit before you observe.</h1>
              <p>{analysis.predictionQuestion.prompt}</p>
            </header>
            <div className="sealed-banner" data-testid="evidence-sealed">
              <span aria-hidden="true">◇</span>
              Verified evidence is sealed until your choice is locked.
            </div>
            <fieldset className="option-list">
              <legend>Choose one prediction</legend>
              {analysis.predictionQuestion.options.map((option, index) => (
                <label key={option.id}>
                  <input
                    type="radio"
                    name="prediction"
                    value={option.id}
                    checked={session.prediction?.optionId === option.id}
                    onChange={() =>
                      dispatch({
                        type: "SELECT_PREDICTION",
                        optionId: option.id,
                        selectedAt: nextTimestamp(clock),
                      })
                    }
                  />
                  <span className="option-index" aria-hidden="true">{String.fromCharCode(65 + index)}</span>
                  <span>{option.label}</span>
                </label>
              ))}
            </fieldset>
            <div className="stage-action-row">
              <p>Your selection cannot be changed after locking.</p>
              <button
                className="primary-button"
                type="button"
                disabled={!session.prediction}
                onClick={handleLockPrediction}
              >
                Lock prediction <span aria-hidden="true">↗</span>
              </button>
            </div>
          </section>
        ) : null}

        {stage === "observe" && analysis ? (
          <section className="stage-shell observe-stage" aria-labelledby="observe-title">
            <header className="stage-heading-block compact">
              <p className="eyebrow">Observe · same case, two predictions</p>
              <h1 id="observe-title">
                {moonComparison ? "Evidence is now visible." : "Your prediction is locked."}
              </h1>
              <p>
                Locked choice: <strong>{optionLabel(analysis.predictionQuestion.options, session.prediction?.optionId)}</strong>
              </p>
            </header>
            {!moonComparison ? (
              <div className="sealed-observation">
                <div className="sealed-worlds" aria-hidden="true"><span>A</span><i>VS</i><span>B</span></div>
                <h2>Ready to run one validated CaseSpec.</h2>
                <p>
                  Both worlds receive the same first-quarter geometry. The deterministic
                  simulator—not the 3D renderer—computes the physical observation.
                </p>
                <button className="primary-button" type="button" onClick={handleRevealEvidence}>
                  Run both worlds and reveal evidence
                </button>
              </div>
            ) : analysis.caseSpec.scenario === "moon-phases" ? (
              <>
                <WorldComparison
                  caseSpec={analysis.caseSpec}
                  learner={moonComparison.learner}
                  scientific={moonComparison.scientific}
                />
                <div className="stage-action-row">
                  <p>Observation recorded. Your locked prediction remains unchanged.</p>
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => {
                      setObservationReviewed(true);
                      setStatus("Use the verified observation to revise your causal explanation.");
                    }}
                  >
                    Revise my explanation <span aria-hidden="true">→</span>
                  </button>
                </div>
              </>
            ) : null}
          </section>
        ) : null}

        {stage === "revise" && analysis && moonComparison ? (
          <section className="revision-layout" aria-labelledby="revise-title">
            <aside className="evidence-brief">
              <p className="micro-label">Evidence to explain</p>
              <h2>{Math.round(moonComparison.scientific.physicalObservation.illuminationFraction * 100)}% illuminated</h2>
              <dl>
                <div><dt>Earth-shadow intersection</dt><dd>{moonComparison.scientific.physicalObservation.earthShadowIntersection}</dd></div>
                <div><dt>Elongation</dt><dd>{analysis.caseSpec.scenario === "moon-phases" ? analysis.caseSpec.elongationDeg : 0}°</dd></div>
                <div><dt>Your locked prediction</dt><dd>{optionLabel(analysis.predictionQuestion.options, session.prediction?.optionId)}</dd></div>
              </dl>
              <p>These values are the verified observation, not either model&apos;s claim.</p>
            </aside>
            <form className="revision-card" onSubmit={handleRevision} noValidate>
              <p className="eyebrow">Revise · explain the evidence</p>
              <h1 id="revise-title">What changed in your explanation?</h1>
              <p>
                Connect a cause to the observation. The check below uses a transparent,
                authored rubric—it is not GPT-5.6 grading.
              </p>
              <label htmlFor="revision-text">Revised causal explanation</label>
              <textarea
                id="revision-text"
                rows={7}
                value={revisionDraft}
                onChange={(event) => setRevisionDraft(event.target.value)}
                maxLength={1_500}
                disabled={Boolean(session.revision)}
                aria-describedby={`revision-help${revisionError ? " revision-error" : ""}`}
                aria-invalid={Boolean(revisionError)}
                placeholder="The Moon appears half lit because…"
              />
              <div className="field-meta" id="revision-help">
                <span>Use evidence plus causal language such as “because” or “therefore.”</span>
                <span>{revisionDraft.length}/1,500</span>
              </div>
              {revisionError ? <div className="api-error" id="revision-error" role="alert"><strong>Revision not advanced</strong><p>{revisionError}</p><p>No AI feedback was invented.</p></div> : null}
              {revisionNotice ? <p className="rubric-notice">{revisionNotice}</p> : null}
              <button
                className="primary-button full-button"
                type="submit"
                disabled={revisionPending}
              >
                {revisionPending
                  ? "Checking authored rubric…"
                  : session.revision
                    ? "Retry authored rubric"
                    : "Capture revision and continue"}
              </button>
            </form>
          </section>
        ) : null}

        {stage === "transfer" && analysis ? (
          <section className="narrow-stage" aria-labelledby="transfer-title">
            <header className="stage-heading-block">
              <p className="eyebrow">Transfer · a new Moon case</p>
              <h1 id="transfer-title">Can your revised model travel?</h1>
              <p>{analysis.transferQuestion.prompt}</p>
            </header>
            <div className="server-check-banner">
              <span aria-hidden="true">⌁</span>
              <div><strong>Server-verified result</strong><p>The answer key is not shipped to this browser. No local fallback grading is allowed.</p></div>
            </div>
            <fieldset className="option-list">
              <legend>Choose one transfer answer</legend>
              {analysis.transferQuestion.options.map((option, index) => (
                <label key={option.id} className={session.transferEvaluationRequest ? "locked" : ""}>
                  <input
                    type="radio"
                    name="transfer"
                    value={option.id}
                    checked={session.transfer?.optionId === option.id}
                    disabled={Boolean(session.transferEvaluationRequest)}
                    onChange={() =>
                      dispatch({
                        type: "SELECT_TRANSFER",
                        optionId: option.id,
                        selectedAt: nextTimestamp(clock),
                      })
                    }
                  />
                  <span className="option-index" aria-hidden="true">{String.fromCharCode(65 + index)}</span>
                  <span>{option.label}</span>
                </label>
              ))}
            </fieldset>
            {transferError ? (
              <div className="api-error" role="alert" data-testid="transfer-error">
                <strong>Server check unavailable</strong>
                <p>{transferError}</p>
                <p>No score was inferred in the browser. Your locked choice remains unchanged.</p>
              </div>
            ) : null}
            <div className="stage-action-row">
              <p>{session.transferEvaluationRequest ? "Choice locked for this request." : "This choice locks when sent."}</p>
              <button
                className="primary-button"
                type="button"
                disabled={!session.transfer || transferPending}
                onClick={handleTransfer}
              >
                {transferPending
                  ? "Checking with server…"
                  : session.transferEvaluationRequest
                    ? "Retry server check"
                    : "Lock and check answer"}
              </button>
            </div>
          </section>
        ) : null}

        {stage === "trace" && session.trace && analysis ? (
          <section className="trace-stage" aria-labelledby="trace-title" data-testid="revision-trace">
            <header className="trace-hero">
              <div className={`result-orb ${session.trace.transfer.result.isCorrect ? "correct" : "incorrect"}`}>
                <span>{session.trace.transfer.result.isCorrect ? "✓" : "↻"}</span>
              </div>
              <p className="eyebrow">Model Revision Trace · complete</p>
              <h1 id="trace-title">
                {session.trace.transfer.result.isCorrect
                  ? "Your revised model transferred."
                  : "The trace found the next question to test."}
              </h1>
              <p>{session.trace.transfer.result.rationale}</p>
            </header>

            <ol className="trace-list">
              <li>
                <span className="trace-number">01</span>
                <div><p>Initial belief</p><h2>{session.trace.initialExplanation}</h2></div>
              </li>
              <li>
                <span className="trace-number">02</span>
                <div><p>Locked prediction</p><h2>{optionLabel(analysis.predictionQuestion.options, session.trace.prediction.optionId)}</h2></div>
              </li>
              <li>
                <span className="trace-number">03</span>
                <div><p>Verified observation</p><h2>
                  {session.trace.observation.scientific.scenario === "moon-phases"
                    ? `${Math.round(session.trace.observation.scientific.physicalObservation.illuminationFraction * 100)}% illuminated; Earth-shadow intersection: ${session.trace.observation.scientific.physicalObservation.earthShadowIntersection}`
                    : "Verified physical observation recorded"}
                </h2></div>
              </li>
              <li>
                <span className="trace-number">04</span>
                <div>
                  <p>Revised explanation</p><h2>{session.trace.revision.text}</h2>
                  <span className="trace-note">Authored deterministic rubric: {session.trace.revision.feedback.conceptualChange} · not AI-graded</span>
                </div>
              </li>
              <li>
                <span className="trace-number">05</span>
                <div>
                  <p>Transfer result</p>
                  <h2>{session.trace.transfer.result.isCorrect ? "Correct · 1/1" : "Not yet · 0/1"}</h2>
                  <span className="trace-note">Verified by {session.trace.transfer.result.source} · receipt {formatReceipt(session.trace.transfer.result.receiptId)}</span>
                </div>
              </li>
            </ol>

            <div className="trace-footer">
              <div><p className="micro-label">What this proves</p><strong>A belief, prediction, observation, revision, and unseen transfer case are connected in one auditable learning trail.</strong></div>
              <button className="primary-button" type="button" onClick={handleReset}>Start a new attempt</button>
            </div>
          </section>
        ) : null}
      </main>

      <footer className="app-footer">
        <span>{PRODUCT.name}</span>
        <p>Two models predict. Evidence decides.</p>
        <span>Built with Codex · GPT-5.6 integration in progress</span>
      </footer>
    </>
  );
}
