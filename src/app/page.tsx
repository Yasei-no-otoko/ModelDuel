import {
  LEARNING_STEPS,
  PRODUCT,
  SAMPLE_MISCONCEPTION,
} from "@/lib/product";

export default function Home() {
  return (
    <>
      <header className="site-header">
        <a className="brand" href="#main-content" aria-label="ModelDuel home">
          <span className="brand-mark" aria-hidden="true">
            M
          </span>
          <span>{PRODUCT.name}</span>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#learning-loop">How it works</a>
          <a className="nav-cta" href="#moon-challenge">
            Try the challenge
          </a>
        </nav>
      </header>

      <main id="main-content">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">
              <span aria-hidden="true" /> Evidence-led science learning
            </p>
            <h1 id="hero-title" aria-label={PRODUCT.tagline}>
              <span>Two models predict.</span>
              <span className="gradient-text">Evidence decides.</span>
            </h1>
            <p className="hero-summary">
              Turn what you think into a world you can test. Compare it with the
              scientific model, make a prediction, and let observation change
              the explanation.
            </p>
            <div className="hero-actions">
              <a className="button button-primary" href="#moon-challenge">
                Start Moon Challenge
                <span aria-hidden="true">→</span>
              </a>
              <a className="button button-quiet" href="#learning-loop">
                Explore the learning loop
              </a>
            </div>
          </div>

          <div className="duel-stage" aria-label="Two moon-phase models compared">
            <div className="stage-heading">
              <span>Same question</span>
              <span className="live-dot">Two testable worlds</span>
            </div>
            <div className="world-grid">
              <article className="world-card learner-world">
                <header>
                  <span className="world-index">A</span>
                  <div>
                    <p>Learner model</p>
                    <strong>Shadow theory</strong>
                  </div>
                </header>
                <div className="orbit-diagram shadow-diagram" aria-hidden="true">
                  <span className="sun" />
                  <span className="orbit" />
                  <span className="earth" />
                  <span className="moon" />
                  <span className="shadow" />
                </div>
                <p className="world-prediction">The shadow should track every phase.</p>
              </article>

              <div className="versus" aria-hidden="true">
                VS
              </div>

              <article className="world-card science-world">
                <header>
                  <span className="world-index">B</span>
                  <div>
                    <p>Scientific model</p>
                    <strong>Viewing angle</strong>
                  </div>
                </header>
                <div className="orbit-diagram light-diagram" aria-hidden="true">
                  <span className="sun" />
                  <span className="light-ray ray-one" />
                  <span className="light-ray ray-two" />
                  <span className="orbit" />
                  <span className="earth" />
                  <span className="moon" />
                </div>
                <p className="world-prediction">The lit half changes with our view.</p>
              </article>
            </div>
            <p className="stage-question">
              <span>Test case</span> Where is the Moon when we see a half moon?
            </p>
          </div>
        </section>

        <aside className="proof-strip" aria-label="Project foundations">
          <div>
            <span>Category</span>
            <strong>{PRODUCT.category}</strong>
          </div>
          <div>
            <span>Runtime intelligence</span>
            <strong>GPT-5.6</strong>
          </div>
          <div>
            <span>Built with</span>
            <strong>Codex</strong>
          </div>
          <p>From explanation to evidence—not answer generation.</p>
        </aside>

        <section
          className="challenge-section"
          id="moon-challenge"
          aria-labelledby="challenge-title"
        >
          <div className="section-copy">
            <p className="eyebrow">Moon phases · first challenge</p>
            <h2 id="challenge-title">Make your invisible model visible.</h2>
            <p>
              Science gets interesting when two explanations disagree. Begin
              with your own words; ModelDuel turns the difference into a question
              that observation can settle.
            </p>
          </div>

          <div className="input-preview">
            <div className="preview-header">
              <span>Authored sample</span>
              <span>Moon phases</span>
            </div>
            <label htmlFor="learner-explanation">Learner explanation</label>
            <textarea
              id="learner-explanation"
              aria-describedby="sample-disclosure"
              readOnly
              rows={3}
              value={SAMPLE_MISCONCEPTION}
            />
            <p id="sample-disclosure">
              Example misconception for the challenge—not a live AI response.
            </p>
            <a className="text-link" href="#learning-loop">
              See what happens next <span aria-hidden="true">↓</span>
            </a>
          </div>
        </section>

        <section
          className="learning-section"
          id="learning-loop"
          aria-labelledby="learning-title"
        >
          <header>
            <p className="eyebrow">A complete learning loop</p>
            <h2 id="learning-title">Understanding leaves a trail.</h2>
            <p>
              Every step captures evidence of how an idea changes, not just
              whether the final answer is correct.
            </p>
          </header>

          <ol className="steps-list">
            {LEARNING_STEPS.map((step, index) => (
              <li key={step.id} data-testid="learning-step">
                <div className="step-number" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </div>
                <div className="step-icon" aria-hidden="true">
                  <span />
                </div>
                <h3>{step.label}</h3>
                <p>{step.description}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="closing-statement" aria-labelledby="closing-title">
          <p>Conceptual change, made observable</p>
          <h2 id="closing-title">
            Don&apos;t correct the learner&apos;s world. Test it.
          </h2>
          <a className="button button-primary" href="#moon-challenge">
            Enter the Moon Challenge <span aria-hidden="true">↑</span>
          </a>
        </section>
      </main>

      <footer>
        <a className="brand" href="#main-content">
          <span className="brand-mark" aria-hidden="true">
            M
          </span>
          <span>{PRODUCT.name}</span>
        </a>
        <p>Evidence-led conceptual learning.</p>
      </footer>
    </>
  );
}
