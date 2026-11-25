"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

interface TravelSceneBackdrop3DProps {
  isPaused?: boolean;
}

function createAirplaneMesh(colorHex: number): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: colorHex,
    emissive: colorHex,
    emissiveIntensity: 0.45,
    roughness: 0.3,
    metalness: 0.6,
  });

  // Sleek paper-plane / jet delta wing silhouette
  const wingGeo = new THREE.BufferGeometry();
  const vertices = new Float32Array([
    0, 0, 0.55,    // nose
    -0.5, 0, -0.35, // left wingtip
    0, 0.08, -0.18, // center spine
    0, 0, 0.55,
    0, 0.08, -0.18,
    0.5, 0, -0.35,  // right wingtip
    0, 0, 0.55,
    0, -0.12, -0.22, // keel bottom
    0, 0.08, -0.18,
  ]);
  wingGeo.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  wingGeo.computeVertexNormals();

  const mesh = new THREE.Mesh(wingGeo, new THREE.MeshStandardMaterial({
    color: colorHex,
    emissive: colorHex,
    emissiveIntensity: 0.5,
    side: THREE.DoubleSide,
    roughness: 0.25,
    metalness: 0.5,
  }));
  group.add(mesh);
  mat.dispose();
  return group;
}

export default function TravelSceneBackdrop3D({ isPaused = false }: TravelSceneBackdrop3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(isPaused);

  useEffect(() => {
    pausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
      55,
      window.innerWidth / Math.max(1, window.innerHeight),
      0.1,
      100
    );
    camera.position.z = 12;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xfde68a, 0.9));
    const sunLight = new THREE.DirectionalLight(0xfb923c, 1.5);
    sunLight.position.set(8, 6, 8);
    scene.add(sunLight);

    // Golden sunset & turquoise floating travel particles
    const particleCount = 450;
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const palette = [
      new THREE.Color(0x2dd4bf),
      new THREE.Color(0xfbbf24),
      new THREE.Color(0xfb7185),
      new THREE.Color(0x38bdf8),
    ];

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 34;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 20;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 18 - 4;
      const c = palette[i % palette.length];
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    pGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const pMat = new THREE.PointsMaterial({
      size: 0.09,
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
    });
    const particles = new THREE.Points(pGeo, pMat);
    scene.add(particles);

    // 3D Gliding Planes on wide scenic curves
    const planeConfigs = [
      { color: 0xfbbf24, radiusX: 11, radiusY: 4.5, speed: 0.22, offset: 0, z: -2 },
      { color: 0x2dd4bf, radiusX: 13, radiusY: 5.5, speed: 0.16, offset: 2.2, z: -4.5 },
      { color: 0xfb7185, radiusX: 9.5, radiusY: 3.5, speed: 0.27, offset: 4.1, z: -3.2 },
    ];

    const planes = planeConfigs.map((cfg) => {
      const mesh = createAirplaneMesh(cfg.color);
      mesh.scale.setScalar(0.58);
      scene.add(mesh);

      // Glowing contrail ribbon
      const trailCount = 28;
      const trailPositions = new Float32Array(trailCount * 3);
      const trailGeo = new THREE.BufferGeometry();
      trailGeo.setAttribute("position", new THREE.BufferAttribute(trailPositions, 3));
      const trailMat = new THREE.LineBasicMaterial({
        color: cfg.color,
        transparent: true,
        opacity: 0.35,
      });
      const trail = new THREE.Line(trailGeo, trailMat);
      scene.add(trail);

      return { cfg, mesh, trail, trailPositions, trailCount };
    });

    let mouseX = 0;
    let mouseY = 0;
    const onPointerMove = (e: PointerEvent) => {
      mouseX = (e.clientX / window.innerWidth - 0.5) * 0.8;
      mouseY = (e.clientY / window.innerHeight - 0.5) * 0.5;
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });

    const onResize = () => {
      camera.aspect = window.innerWidth / Math.max(1, window.innerHeight);
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", onResize);

    let rafId = 0;
    let t = 0;

    const animate = () => {
      const paused = pausedRef.current || prefersReduced;
      if (!paused) {
        t += 0.014;
        particles.rotation.y += 0.00045;
        particles.rotation.x = Math.sin(t * 0.15) * 0.05;

        planes.forEach((p) => {
          const angle = t * p.cfg.speed + p.cfg.offset;
          const x = Math.cos(angle) * p.cfg.radiusX;
          const y = Math.sin(angle * 1.4) * p.cfg.radiusY * 0.6 + 1.2;
          const z = p.cfg.z + Math.sin(angle) * 2.5;

          const nextAngle = angle + 0.05;
          const nx = Math.cos(nextAngle) * p.cfg.radiusX;
          const ny = Math.sin(nextAngle * 1.4) * p.cfg.radiusY * 0.6 + 1.2;
          const nz = p.cfg.z + Math.sin(nextAngle) * 2.5;

          p.mesh.position.set(x, y, z);
          p.mesh.lookAt(nx, ny, nz);
          p.mesh.rotateZ(Math.sin(angle) * 0.25);

          // Update contrail points behind plane
          for (let i = 0; i < p.trailCount; i++) {
            const ta = angle - i * 0.045;
            p.trailPositions[i * 3] = Math.cos(ta) * p.cfg.radiusX;
            p.trailPositions[i * 3 + 1] = Math.sin(ta * 1.4) * p.cfg.radiusY * 0.6 + 1.2;
            p.trailPositions[i * 3 + 2] = p.cfg.z + Math.sin(ta) * 2.5;
          }
          p.trail.geometry.attributes.position.needsUpdate = true;
        });

        camera.position.x += (mouseX - camera.position.x) * 0.03;
        camera.position.y += (-mouseY - camera.position.y) * 0.03;
        camera.lookAt(0, 0, 0);
      }

      renderer.render(scene, camera);
      rafId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("resize", onResize);
      pGeo.dispose();
      pMat.dispose();
      planes.forEach((p) => {
        p.trail.geometry.dispose();
        (p.trail.material as THREE.Material).dispose();
      });
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="pointer-events-none fixed inset-0 z-0 opacity-80"
      aria-hidden="true"
    />
  );
}
