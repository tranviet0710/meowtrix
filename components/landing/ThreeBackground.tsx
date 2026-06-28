"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Three.js animated background for the landing hero.
 *
 * Renders a particle field (yellow informants, green active agents) orbiting
 * a wireframe icosahedron representing the MEOWTRIX command HQ. The scene
 * gently parallaxes with the cursor for a "command center" feel.
 *
 * Performance:
 *  - Capped DPR (2 max)
 *  - Reduced particle count on small screens
 *  - Respects prefers-reduced-motion
 *  - Cleans up on unmount
 */
export function ThreeBackground() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    const isMobile = window.innerWidth < 768;

    // --- Scene + camera + renderer ---
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(70, width / height, 0.1, 1000);
    camera.position.set(0, 0, 32);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: !isMobile,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    // --- Particle field (informants worldwide) ---
    const particleCount = isMobile ? 600 : 1400;
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const yellow = new THREE.Color(0xffcc00);
    const green = new THREE.Color(0x00ff88);
    const muted = new THREE.Color(0x8892b0);

    for (let i = 0; i < particleCount; i++) {
      // Spherical distribution looks more organic than a cube.
      const r = 20 + Math.random() * 40;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      const roll = Math.random();
      const color = roll > 0.92 ? green : roll > 0.5 ? yellow : muted;
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    particleGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const particleMat = new THREE.PointsMaterial({
      size: isMobile ? 0.18 : 0.14,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      sizeAttenuation: true,
      depthWrite: false,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // --- Wireframe HQ globe ---
    const globeGeo = new THREE.IcosahedronGeometry(9, 1);
    const globeMat = new THREE.MeshBasicMaterial({
      color: 0xffcc00,
      wireframe: true,
      transparent: true,
      opacity: 0.18,
    });
    const globe = new THREE.Mesh(globeGeo, globeMat);
    scene.add(globe);

    // Inner pulsing core
    const coreGeo = new THREE.IcosahedronGeometry(2.4, 0);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xffcc00,
      wireframe: true,
      transparent: true,
      opacity: 0.55,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    scene.add(core);

    // --- Mouse parallax ---
    let targetX = 0;
    let targetY = 0;
    const onPointerMove = (e: PointerEvent) => {
      targetX = (e.clientX / window.innerWidth - 0.5) * 2;
      targetY = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });

    // --- Resize ---
    const onResize = () => {
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    // --- Animation loop ---
    let animationId = 0;
    let frame = 0;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      frame += 1;

      if (!prefersReduced) {
        particles.rotation.y += 0.0009;
        particles.rotation.x += 0.0004;
        globe.rotation.y -= 0.0014;
        globe.rotation.x += 0.0008;
        core.rotation.y += 0.004;
        core.rotation.x -= 0.003;

        // Pulse the core scale on a slow sine wave.
        const pulse = 1 + Math.sin(frame * 0.03) * 0.12;
        core.scale.setScalar(pulse);
      }

      // Smooth parallax toward mouse target.
      camera.position.x += (targetX * 4 - camera.position.x) * 0.04;
      camera.position.y += (-targetY * 3 - camera.position.y) * 0.04;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    };
    animate();

    // --- Cleanup ---
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("resize", onResize);
      particleGeo.dispose();
      particleMat.dispose();
      globeGeo.dispose();
      globeMat.dispose();
      coreGeo.dispose();
      coreMat.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden="true"
    />
  );
}
