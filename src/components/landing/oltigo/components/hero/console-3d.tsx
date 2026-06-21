"use client";

import { ContactShadows, Html, RoundedBox } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Component, type ReactNode, useRef } from "react";
import * as THREE from "three";
import type { Dictionary } from "@/components/landing/oltigo/i18n/dictionaries";
import { ConsoleStatic } from "./console-static";
import { AgendaFace, DossierFace, WhatsappFace } from "./faces";

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const clamp01 = (x: number) => Math.min(Math.max(x, 0), 1);
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

const EXPLODE_PERIOD = 5.2; // seconds between focus steps
const explodeEnv = (localT: number) =>
  smoothstep(0.12, 0.42, localT) * (1 - smoothstep(0.58, 0.9, localT));

type SlabProps = {
  index: number;
  baseY: number;
  xOff: number;
  breatheRate: number;
  breathePhase: number;
  children: ReactNode;
};

function Slab({ index, baseY, xOff, breatheRate, breathePhase, children }: SlabProps) {
  const group = useRef<THREE.Group>(null);
  const mat = useRef<THREE.MeshStandardMaterial>(null);

  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const t = state.clock.elapsedTime;

    // 1) Assemble — slide + settle with real mass, ease-out, 80ms stagger, no bounce.
    const a = easeOutCubic(clamp01((t - index * 0.08) / 0.9));

    // 2) Breathing — each layer floats on its own offset rhythm, never in unison.
    const breathe = Math.sin(t * breatheRate + breathePhase) * 0.07;

    // 3) Auto-explode — focused layer steps forward, others recede + fade (faux DOF).
    const idx = Math.floor(t / EXPLODE_PERIOD) % 3;
    const localT = (t % EXPLODE_PERIOD) / EXPLODE_PERIOD;
    const env = explodeEnv(localT);

    let z = 0;
    let extraY = 0;
    let scale = 1;
    let opacity = 1;
    if (index === idx) {
      z = env * 0.95;
      scale = 1 + env * 0.05;
    } else {
      z = -env * 0.5;
      opacity = 1 - env * 0.55;
      scale = 1 - env * 0.03;
      extraY = (index < idx ? 1 : -1) * env * 0.4;
    }

    const homeY = baseY + breathe + extraY;
    const startY = baseY - 0.55; // assembles from just below
    g.position.set(xOff, homeY * a + startY * (1 - a), z);
    g.scale.setScalar(scale * (0.965 + 0.035 * a));
    if (mat.current) {
      mat.current.transparent = true;
      mat.current.opacity = opacity * a;
    }
  });

  return (
    <group ref={group} position={[xOff, baseY, 0]}>
      {/* The physical slab: brushed-matte aluminium edge + frosted matte glass. */}
      <RoundedBox args={[3.5, 1.95, 0.12]} radius={0.07} smoothness={5} castShadow receiveShadow>
        <meshStandardMaterial
          ref={mat}
          color="#283134"
          roughness={0.5}
          metalness={0.55}
          emissive="#0e1314"
          emissiveIntensity={0.5}
        />
      </RoundedBox>
      {/* Crisp DOM face on the slab front. distanceFactor is the one size knob. */}
      <Html transform distanceFactor={2.55} position={[0, 0, 0.09]} pointerEvents="none" prepend>
        <div style={{ transform: "translate(-50%, -50%)" }}>{children}</div>
      </Html>
    </group>
  );
}

function FocusReporter({ onFocus }: { onFocus: (i: number) => void }) {
  const last = useRef(-2);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const idx = Math.floor(t / EXPLODE_PERIOD) % 3;
    const env = explodeEnv((t % EXPLODE_PERIOD) / EXPLODE_PERIOD);
    const shown = env > 0.28 ? idx : -1;
    if (shown !== last.current) {
      last.current = shown;
      onFocus(shown);
    }
  });
  return null;
}

function Rig({ onFocus, dict }: { onFocus: (i: number) => void; dict: Dictionary }) {
  const root = useRef<THREE.Group>(null);

  useFrame((state) => {
    const r = root.current;
    if (!r) return;
    const t = state.clock.elapsedTime;
    // Anchored sway — like an instrument held in a steady hand. No turntable.
    const swayY = Math.sin(t * 0.31) * 0.035; // ±2°
    const swayX = Math.sin(t * 0.23) * 0.017; // ±1°
    // Cursor parallax on top, max ~3°.
    const targetY = swayY + state.pointer.x * 0.052;
    const targetX = swayX - state.pointer.y * 0.052;
    r.rotation.y += (targetY - r.rotation.y) * 0.05;
    r.rotation.x += (targetX - r.rotation.x) * 0.05;
  });

  return (
    <>
      <ambientLight intensity={0.9} />
      {/* one soft key, upper-left */}
      <directionalLight
        position={[-4, 5, 4]}
        intensity={2.3}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
      />
      {/* soft frontal fill so the slab faces read */}
      <directionalLight position={[0, 0.5, 6]} intensity={0.6} />
      {/* gentle cool rim */}
      <directionalLight position={[5, 1.5, -3]} intensity={0.4} color="#4AA6C9" />
      <group ref={root}>
        <Slab index={0} baseY={1.55} xOff={0.4} breatheRate={0.62} breathePhase={0}>
          <AgendaFace />
        </Slab>
        <Slab index={1} baseY={0} xOff={-0.12} breatheRate={0.52} breathePhase={2.1}>
          <DossierFace dict={dict} />
        </Slab>
        <Slab index={2} baseY={-1.55} xOff={-0.55} breatheRate={0.74} breathePhase={4.0}>
          <WhatsappFace dict={dict} />
        </Slab>
      </group>
      {/* one large soft contact shadow on a matte floor */}
      <ContactShadows
        position={[0, -2.5, 0]}
        opacity={0.5}
        blur={2.9}
        scale={11}
        far={4.2}
        color="#000000"
      />
      <FocusReporter onFocus={onFocus} />
    </>
  );
}

/** Falls back to the static console if WebGL throws at any point. */
class WebGLBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    if (this.state.failed) return <ConsoleStatic />;
    return this.props.children;
  }
}

export default function Console3D({
  onFocus,
  dict,
}: {
  onFocus: (i: number) => void;
  dict: Dictionary;
}) {
  return (
    <WebGLBoundary>
      <div className="h-[520px] w-full">
        <Canvas
          shadows
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
          camera={{ position: [0, 0, 8], fov: 32 }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping; // ACES-neutral grade
            gl.toneMappingExposure = 1.0;
          }}
        >
          <Rig onFocus={onFocus} dict={dict} />
        </Canvas>
      </div>
    </WebGLBoundary>
  );
}
