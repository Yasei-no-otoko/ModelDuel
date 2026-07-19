import { BackSide, Quaternion, Vector3, type Vector3Tuple } from "three";

export function SunBody({
  position,
  radius = 0.55,
}: Readonly<{ position: Vector3Tuple; radius?: number }>) {
  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[radius, 32, 20]} />
        <meshBasicMaterial color="#f2b765" toneMapped={false} />
      </mesh>
      <mesh scale={1.24}>
        <sphereGeometry args={[radius, 24, 16]} />
        <meshBasicMaterial
          color="#f2b765"
          transparent
          opacity={0.12}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <pointLight color="#f6c97d" intensity={30} distance={11} decay={2} />
    </group>
  );
}

export function EarthBody({
  accent = "#55dceb",
  position = [0, 0, 0],
  radius = 0.56,
}: Readonly<{
  accent?: string;
  position?: Vector3Tuple;
  radius?: number;
}>) {
  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[radius, 36, 24]} />
        <meshStandardMaterial
          color="#286aa5"
          metalness={0.04}
          roughness={0.68}
        />
      </mesh>
      <mesh scale={1.045}>
        <sphereGeometry args={[radius, 28, 18]} />
        <meshBasicMaterial
          color={accent}
          transparent
          opacity={0.1}
          side={BackSide}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh scale={1.012} rotation={[0.4, 0.2, 0]}>
        <sphereGeometry args={[radius, 16, 10]} />
        <meshBasicMaterial
          color={accent}
          wireframe
          transparent
          opacity={0.1}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

export function MoonBody({
  position,
  radius = 0.34,
}: Readonly<{ position: Vector3Tuple; radius?: number }>) {
  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[radius, 32, 20]} />
        <meshStandardMaterial color="#d9dfdf" metalness={0.02} roughness={0.88} />
      </mesh>
      <mesh position={[radius * 0.58, radius * 0.34, radius * 0.42]} scale={[1, 0.7, 0.28]}>
        <sphereGeometry args={[radius * 0.15, 12, 8]} />
        <meshStandardMaterial color="#9ba6aa" roughness={1} />
      </mesh>
      <mesh position={[radius * 0.64, -radius * 0.3, radius * 0.25]} scale={[1, 0.7, 0.24]}>
        <sphereGeometry args={[radius * 0.1, 10, 8]} />
        <meshStandardMaterial color="#aeb7ba" roughness={1} />
      </mesh>
    </group>
  );
}

export function OrbitRing({
  color,
  opacity = 0.38,
  radius,
  rotation = [Math.PI / 2, 0, 0],
}: Readonly<{
  color: string;
  opacity?: number;
  radius: number;
  rotation?: Vector3Tuple;
}>) {
  return (
    <mesh rotation={rotation}>
      <torusGeometry args={[radius, 0.012, 8, 96]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={opacity}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

export function LightBeam({
  color,
  end,
  opacity = 0.4,
  radius = 0.012,
  start,
}: Readonly<{
  color: string;
  end: Vector3Tuple;
  opacity?: number;
  radius?: number;
  start: Vector3Tuple;
}>) {
  const origin = new Vector3(...start);
  const destination = new Vector3(...end);
  const direction = destination.clone().sub(origin);
  const length = direction.length();
  const midpoint = origin.clone().add(destination).multiplyScalar(0.5);
  const quaternion = new Quaternion().setFromUnitVectors(
    new Vector3(0, 1, 0),
    direction.normalize(),
  );

  return (
    <mesh position={midpoint} quaternion={quaternion}>
      <cylinderGeometry args={[radius, radius, length, 8]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={opacity}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

export function DirectionVector({
  color,
  end,
  opacity = 0.72,
  radius = 0.014,
  start,
}: Readonly<{
  color: string;
  end: Vector3Tuple;
  opacity?: number;
  radius?: number;
  start: Vector3Tuple;
}>) {
  const origin = new Vector3(...start);
  const destination = new Vector3(...end);
  const unit = destination.clone().sub(origin).normalize();
  const headLength = radius * 8;
  const headPosition = destination.clone().addScaledVector(unit, -headLength / 2);
  const quaternion = new Quaternion().setFromUnitVectors(
    new Vector3(0, 1, 0),
    unit,
  );

  return (
    <group>
      <LightBeam
        color={color}
        start={start}
        end={end}
        opacity={opacity}
        radius={radius}
      />
      <mesh position={headPosition} quaternion={quaternion}>
        <coneGeometry args={[radius * 3.4, headLength, 10]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={opacity}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

export function AngleArc({
  color,
  opacity = 0.72,
  position = [0, 0, 0],
  radius = 0.72,
  rotation = [0, 0, 0],
}: Readonly<{
  color: string;
  opacity?: number;
  position?: Vector3Tuple;
  radius?: number;
  rotation?: Vector3Tuple;
}>) {
  return (
    <mesh position={position} rotation={rotation}>
      <torusGeometry args={[radius, 0.018, 8, 40, Math.PI / 2]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={opacity}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

export function ValueHalo({
  color,
  opacity,
  position,
  radius,
}: Readonly<{
  color: string;
  opacity: number;
  position: Vector3Tuple;
  radius: number;
}>) {
  return (
    <mesh position={position}>
      <ringGeometry args={[radius * 0.74, radius, 48]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={opacity}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}
