"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

interface GenieOrb3DProps {
  isThinking: boolean;
  isPaused?: boolean;
  size?: number;
}

export default function GenieOrb3D({ isThinking, isPaused = false, size = 54 }: GenieOrb3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef({ isThinking, isPaused });

  useEffect(() => {
    stateRef.current = { isThinking, isPaused };
  }, [isThinking, isPaused]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.z = 3.75;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(size, size);
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    // Inner Turquoise Globe Wireframe
    const globeGeo = new THREE.IcosahedronGeometry(0.86, 1);
    const globeMat = new THREE.MeshBasicMaterial({
      color: 0x2dd4bf,
      wireframe: true,
      transparent: true,
      opacity: 0.78,
    });
    const globeMesh = new THREE.Mesh(globeGeo, globeMat);
    scene.add(globeMesh);

    // Glowing Sunset-Lagoon Core Crystal
    const coreGeo = new THREE.OctahedronGeometry(0.48, 1);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0x14b8a6,
      emissiveIntensity: 1.35,
      roughness: 0.2,
      metalness: 0.8,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    scene.add(coreMesh);

    // Golden Astrolabe Gimbal Rings
    const ringGeo1 = new THREE.TorusGeometry(1.18, 0.032, 12, 64);
    const ringMat1 = new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.85 });
    const ring1 = new THREE.Mesh(ringGeo1, ringMat1);
    ring1.rotation.x = Math.PI / 3;
    scene.add(ring1);

    const ringGeo2 = new THREE.TorusGeometry(1.36, 0.022, 12, 64);
    const ringMat2 = new THREE.MeshBasicMaterial({ color: 0xfb7185, transparent: true, opacity: 0.55 });
    const ring2 = new THREE.Mesh(ringGeo2, ringMat2);
    ring2.rotation.y = Math.PI / 2.2;
    scene.add(ring2);

    // Orbiting miniature golden flight beacon
    const satGeo = new THREE.SphereGeometry(0.085, 12, 12);
    const satMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const sat = new THREE.Mesh(satGeo, satMat);
    scene.add(sat);

    const light1 = new THREE.PointLight(0x2dd4bf, 4, 10);
    light1.position.set(2, 2, 3);
    scene.add(light1);

    const light2 = new THREE.PointLight(0xfb923c, 3.5, 10);
    light2.position.set(-2, -2, 2);
    scene.add(light2);

    let rafId = 0;
    let t = 0;

    const renderFrame = () => {
      const { isThinking: thinking, isPaused: paused } = stateRef.current;
      if (!paused && !prefersReduced) {
        const speed = thinking ? 0.055 : 0.016;
        t += speed;
        globeMesh.rotation.y += speed * 0.9;
        globeMesh.rotation.x += speed * 0.35;
        coreMesh.rotation.y -= speed * 1.5;
        ring1.rotation.z += speed * 1.3;
        ring1.rotation.y += speed * 0.4;
        ring2.rotation.x -= speed * 1.1;

        const pulse = 1 + Math.sin(t * 2.4) * (thinking ? 0.16 : 0.07);
        coreMesh.scale.setScalar(pulse);

        sat.position.set(
          Math.cos(t * 2.1) * 1.36,
          Math.sin(t * 1.4) * 0.7,
          Math.sin(t * 2.1) * 1.36
        );
      }

      const targetWire = thinking ? 0xfbbf24 : 0x2dd4bf;
      const targetCore = thinking ? 0xfb7185 : 0x14b8a6;
      globeMat.color.lerp(new THREE.Color(targetWire), 0.08);
      coreMat.emissive.lerp(new THREE.Color(targetCore), 0.08);

      renderer.render(scene, camera);
      rafId = requestAnimationFrame(renderFrame);
    };

    renderFrame();

    return () => {
      cancelAnimationFrame(rafId);
      globeGeo.dispose();
      globeMat.dispose();
      coreGeo.dispose();
      coreMat.dispose();
      ringGeo1.dispose();
      ringMat1.dispose();
      ringGeo2.dispose();
      ringMat2.dispose();
      satGeo.dispose();
      satMat.dispose();
      renderer.dispose();
    };
  }, [size]);

  return (
    <div
      ref={containerRef}
      style={{ width: size, height: size }}
      className="relative shrink-0 rounded-full flex items-center justify-center"
      aria-hidden="true"
    />
  );
}
