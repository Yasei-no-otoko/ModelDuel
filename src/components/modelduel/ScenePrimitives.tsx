import { BackSide, Quaternion, Vector3, type Vector3Tuple } from "three";

const STAR_POSITIONS = new Float32Array([
  -6.8, 3.2, -3.4, -5.7, -2.4, -4.8, -4.8, 1.1, -5.2, -3.9, 4.2, -5.6,
  -2.7, -3.4, -4.1, -1.8, 2.6, -5.8, -0.9, -1.5, -5.2, 0.1, 4.1, -5.5,
  1.2, -3.2, -4.4, 2.1, 1.9, -5.9, 3.1, -1.1, -5.1, 4.0, 3.7, -4.7,
  4.9, -2.8, -5.4, 5.8, 1.3, -4.5, 6.7, 3.1, -5.7, -6.2, 0.2, -4.9,
  -4.4, -0.8, -5.6, -3.3, 2.9, -4.6, -2.2, 0.3, -5.4, -1.1, 3.6, -4.3,
  0.8, 0.7, -5.7, 1.7, -2.5, -5.0, 2.8, 3.3, -5.3, 3.8, 0.4, -4.2,
  5.2, 2.6, -5.0, 6.1, -1.8, -5.8,
]);

export function TechnicalStarField({ opacity = 0.56 }: Readonly<{ opacity?: number }>) {
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[STAR_POSITIONS, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#c9e8f4"
        size={0.055}
        sizeAttenuation
        transparent
        opacity={opacity}
        depthWrite={false}
        toneMapped={false}
      />
    </points>
  );
}

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
