"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Compass, Pause, Play, Plane, RotateCcw } from "lucide-react";
import type { DestinationSuggestion, TripPlan } from "@/types/travel";

interface Globe3DProps {
  activeTrip: TripPlan | null;
  suggestions?: DestinationSuggestion[];
  focusedCoords?: { lat: number; lng: number; label?: string } | null;
  isPaused: boolean;
  onTogglePause: () => void;
  onSelectSuggestion?: (dest: DestinationSuggestion) => void;
  pauseLabel: string;
  playLabel: string;
}

function latLngToVector3(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
}

function createSculptedPlane(): THREE.Group {
  const plane = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xfbbf24,
    emissiveIntensity: 0.75,
    roughness: 0.25,
    metalness: 0.6,
  });

  // Fuselage pointing along +Z
  const fuseGeo = new THREE.ConeGeometry(0.016, 0.09, 8);
  fuseGeo.rotateX(Math.PI / 2);
  const fuse = new THREE.Mesh(fuseGeo, bodyMat);
  plane.add(fuse);

  // Swept delta wings
  const wingGeo = new THREE.BoxGeometry(0.095, 0.005, 0.028);
  const wings = new THREE.Mesh(wingGeo, bodyMat);
  wings.position.set(0, 0, -0.006);
  plane.add(wings);

  // Tail fin
  const tailGeo = new THREE.BoxGeometry(0.005, 0.024, 0.018);
  const tail = new THREE.Mesh(tailGeo, bodyMat);
  tail.position.set(0, 0.012, -0.036);
  plane.add(tail);

  return plane;
}

const CONTINENTS: [number, number][][] = [
  [[-168,65],[-160,71],[-135,70],[-105,72],[-82,66],[-64,60],[-53,47],[-67,44],[-75,35],[-81,25],[-88,21],[-84,10],[-78,8],[-84,12],[-92,15],[-105,20],[-112,28],[-122,37],[-125,49],[-138,59],[-152,60]],
  [[-55,60],[-42,60],[-20,70],[-18,81],[-45,83],[-68,77]],
  [[-78,9],[-70,12],[-60,8],[-50,1],[-35,-6],[-38,-14],[-42,-23],[-53,-33],[-65,-42],[-68,-54],[-74,-52],[-73,-40],[-71,-30],[-71,-18],[-77,-12],[-81,-4]],
  [[-9,37],[-9,43],[-2,43],[2,51],[8,54],[6,61],[18,69],[28,71],[42,68],[58,66],[52,52],[40,46],[29,41],[23,37],[16,38],[12,44],[5,43],[-5,36]],
  [[-6,50],[1,51],[1,58],[-6,58],[-9,53]],
  [[-17,15],[-12,28],[-6,36],[10,37],[25,32],[33,30],[43,12],[51,12],[41,-2],[40,-14],[33,-26],[20,-35],[15,-27],[12,-15],[9,4],[-5,5],[-14,10]],
  [[44,-25],[47,-13],[50,-15],[47,-25]],
  [[28,41],[42,42],[50,40],[55,55],[65,68],[95,74],[135,71],[170,66],[162,55],[142,53],[136,44],[128,35],[122,39],[120,30],[114,22],[108,16],[104,2],[100,13],[96,17],[90,22],[85,19],[78,8],[72,20],[67,25],[57,26],[48,29],[35,28]],
  [[130,32],[135,34],[141,38],[145,44],[140,41],[136,36],[131,34]],
  [[96,5],[105,-6],[115,-8],[118,1],[110,1],[104,-2]],
  [[120,-2],[128,1],[134,-5],[126,-8]],
  [[114,-22],[122,-17],[131,-12],[136,-12],[142,-11],[146,-18],[153,-26],[150,-37],[140,-38],[135,-34],[125,-33],[115,-34]],
  [[167,-46],[172,-43],[178,-37],[174,-35],[172,-41]],
];

function createGlobeTexture(): THREE.CanvasTexture {
  const width = 2048;
  const height = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  // Tropical twilight ocean gradient
  const oceanGrad = ctx.createLinearGradient(0, 0, 0, height);
  oceanGrad.addColorStop(0, "#051226");
  oceanGrad.addColorStop(0.5, "#09213c");
  oceanGrad.addColorStop(1, "#051020");
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(0, 0, width, height);

  // Subtle navigation meridians
  ctx.strokeStyle = "rgba(45, 212, 191, 0.11)";
  ctx.lineWidth = 1;
  for (let lng = -180; lng <= 180; lng += 15) {
    const x = ((lng + 180) / 360) * width;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let lat = -75; lat <= 75; lat += 15) {
    const y = ((90 - lat) / 180) * height;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Continents with turquoise-emerald fill & golden-teal coastlines
  ctx.save();
  ctx.fillStyle = "rgba(19, 78, 94, 0.92)";
  ctx.strokeStyle = "rgba(94, 234, 212, 0.78)";
  ctx.lineWidth = 2.4;
  ctx.shadowColor = "rgba(45, 212, 191, 0.55)";
  ctx.shadowBlur = 12;

  for (const poly of CONTINENTS) {
    ctx.beginPath();
    poly.forEach(([lng, lat], idx) => {
      const x = ((lng + 180) / 360) * width;
      const y = ((90 - lat) / 180) * height;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();

  // Warm golden city-light hubs
  const hubs: [number, number][] = [
    [139.65, 35.67], [2.35, 48.85], [-0.12, 51.5], [-74, 40.71], [72.87, 19.07],
    [77.2, 28.61], [103.81, 1.35], [55.27, 25.2], [115.18, -8.4], [151.2, -33.86],
    [12.49, 41.9], [-46.63, -23.55], [31.23, 30.04], [126.97, 37.56], [100.5, 13.75],
    [-122.4, 37.77], [7.86, 46.68], [25.46, 36.39],
  ];
  for (const [lng, lat] of hubs) {
    const x = ((lng + 180) / 360) * width;
    const y = ((90 - lat) / 180) * height;
    const g = ctx.createRadialGradient(x, y, 0, x, y, 18);
    g.addColorStop(0, "rgba(251, 191, 36, 0.95)");
    g.addColorStop(0.45, "rgba(251, 146, 60, 0.42)");
    g.addColorStop(1, "rgba(45, 212, 191, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, 18, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export default function Globe3D({
  activeTrip,
  suggestions = [],
  focusedCoords,
  isPaused,
  onTogglePause,
  onSelectSuggestion,
  pauseLabel,
  playLabel,
}: Globe3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const targetTargetRef = useRef<{ theta: number; phi: number } | null>(null);
  const isPausedRef = useRef(isPaused);
  const [zoomDistance, setZoomDistance] = useState(3.15);
  const zoomRef = useRef(3.15);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    zoomRef.current = zoomDistance;
  }, [zoomDistance]);

  useEffect(() => {
    const lat = focusedCoords?.lat ?? activeTrip?.lat;
    const lng = focusedCoords?.lng ?? activeTrip?.lng;
    if (typeof lat === "number" && typeof lng === "number") {
      const vec = latLngToVector3(lat, lng, 1).normalize();
      const phi = Math.acos(THREE.MathUtils.clamp(vec.y, -1, 1));
      const theta = Math.atan2(vec.x, vec.z);
      targetTargetRef.current = { theta, phi };
    }
  }, [activeTrip?.lat, activeTrip?.lng, focusedCoords?.lat, focusedCoords?.lng]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const scene = new THREE.Scene();

    const width = container.clientWidth || 500;
    const height = container.clientHeight || 360;
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xdbeafe, 1.35));
    const sunLight = new THREE.DirectionalLight(0xfbbf24, 1.9);
    sunLight.position.set(5, 3, 5);
    scene.add(sunLight);

    // Starfield
    const starCount = 1200;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r = 12 + Math.random() * 20;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      starPositions[i * 3 + 2] = r * Math.cos(phi);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xfef3c7, size: 0.055, transparent: true, opacity: 0.78 });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    // Globe
    const globeRadius = 1.08;
    const globeTex = createGlobeTexture();
    const globeGeo = new THREE.SphereGeometry(globeRadius, 64, 64);
    const globeMat = new THREE.MeshStandardMaterial({
      map: globeTex,
      roughness: 0.58,
      metalness: 0.28,
    });
    const globeMesh = new THREE.Mesh(globeGeo, globeMat);
    scene.add(globeMesh);

    // Golden-Lagoon Fresnel Atmosphere Halo
    const atmosGeo = new THREE.SphereGeometry(globeRadius * 1.12, 64, 64);
    const atmosMat = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.70 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.0);
          vec3 lagoon = vec3(0.18, 0.83, 0.75);
          vec3 sunset = vec3(0.98, 0.75, 0.14);
          vec3 col = mix(lagoon, sunset, clamp(vNormal.x * 0.5 + 0.5, 0.0, 1.0));
          gl_FragColor = vec4(col, 1.0) * intensity * 0.88;
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
    });
    const atmosMesh = new THREE.Mesh(atmosGeo, atmosMat);
    scene.add(atmosMesh);

    // Dual Compass Orbit Halos
    const orbitRingGeo = new THREE.TorusGeometry(globeRadius * 1.32, 0.005, 8, 128);
    const orbitRingMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.3,
    });
    const orbitRing = new THREE.Mesh(orbitRingGeo, orbitRingMat);
    orbitRing.rotation.x = Math.PI / 2.25;
    orbitRing.rotation.y = 0.2;
    scene.add(orbitRing);

    const orbitRing2Geo = new THREE.TorusGeometry(globeRadius * 1.4, 0.003, 8, 128);
    const orbitRing2Mat = new THREE.MeshBasicMaterial({
      color: 0x2dd4bf,
      transparent: true,
      opacity: 0.22,
    });
    const orbitRing2 = new THREE.Mesh(orbitRing2Geo, orbitRing2Mat);
    orbitRing2.rotation.x = -Math.PI / 3;
    orbitRing2.rotation.z = 0.4;
    scene.add(orbitRing2);

    // Markers & Flight Arc Group
    const markersGroup = new THREE.Group();
    globeMesh.add(markersGroup);

    const pulseRings: THREE.Mesh[] = [];
    let travelerPlane: THREE.Group | null = null;
    let flightCurve: THREE.QuadraticBezierCurve3 | null = null;

    const addMarker = (lat: number, lng: number, colorHex: number, scale = 1, withPillar = false) => {
      const surfacePos = latLngToVector3(lat, lng, globeRadius + 0.01);
      const normal = surfacePos.clone().normalize();

      const pinGeo = new THREE.SphereGeometry(0.024 * scale, 16, 16);
      const pinMat = new THREE.MeshBasicMaterial({ color: colorHex });
      const pin = new THREE.Mesh(pinGeo, pinMat);
      pin.position.copy(surfacePos);
      markersGroup.add(pin);

      if (withPillar) {
        const pillarHeight = 0.12 * scale;
        const pillarGeo = new THREE.CylinderGeometry(0.004, 0.012, pillarHeight, 10);
        const pillarMat = new THREE.MeshBasicMaterial({
          color: colorHex,
          transparent: true,
          opacity: 0.72,
        });
        const pillar = new THREE.Mesh(pillarGeo, pillarMat);
        pillar.position.copy(surfacePos.clone().add(normal.clone().multiplyScalar(pillarHeight * 0.5)));
        pillar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
        markersGroup.add(pillar);
      }

      const ringGeo = new THREE.RingGeometry(0.032 * scale, 0.05 * scale, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.copy(surfacePos);
      ring.lookAt(surfacePos.clone().multiplyScalar(2));
      markersGroup.add(ring);
      pulseRings.push(ring);
    };

    if (activeTrip) {
      addMarker(activeTrip.originLat, activeTrip.originLng, 0x2dd4bf, 1.0, true);
      addMarker(activeTrip.lat, activeTrip.lng, 0xfbbf24, 1.35, true);

      const start = latLngToVector3(activeTrip.originLat, activeTrip.originLng, globeRadius + 0.015);
      const end = latLngToVector3(activeTrip.lat, activeTrip.lng, globeRadius + 0.015);
      const dist = start.distanceTo(end);
      if (dist > 0.08) {
        const mid = start
          .clone()
          .add(end)
          .multiplyScalar(0.5)
          .normalize()
          .multiplyScalar(globeRadius + 0.24 + dist * 0.3);
        flightCurve = new THREE.QuadraticBezierCurve3(start, mid, end);
        const arcPoints = flightCurve.getPoints(72);
        const arcGeo = new THREE.BufferGeometry().setFromPoints(arcPoints);
        const arcMat = new THREE.LineBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.85 });
        const arcLine = new THREE.Line(arcGeo, arcMat);
        markersGroup.add(arcLine);

        travelerPlane = createSculptedPlane();
        markersGroup.add(travelerPlane);
      }

      activeTrip.days.slice(0, 3).forEach((d) => {
        d.activities.slice(0, 3).forEach((act) => {
          addMarker(act.lat, act.lng, 0x38bdf8, 0.55, false);
        });
      });
    }

    suggestions.forEach((s) => {
      addMarker(s.lat, s.lng, 0xfb7185, 1.05, true);
    });

    let currentTheta = 2.2;
    let currentPhi = 1.15;
    let isDragging = false;
    let prevX = 0;
    let prevY = 0;

    const onPointerDown = (e: PointerEvent) => {
      isDragging = true;
      prevX = e.clientX;
      prevY = e.clientY;
      targetTargetRef.current = null;
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - prevX;
      const dy = e.clientY - prevY;
      prevX = e.clientX;
      prevY = e.clientY;
      currentTheta -= dx * 0.007;
      currentPhi = THREE.MathUtils.clamp(currentPhi - dy * 0.007, 0.25, Math.PI - 0.25);
    };
    const onPointerUp = () => {
      isDragging = false;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const next = THREE.MathUtils.clamp(zoomRef.current + e.deltaY * 0.0016, 2.05, 4.5);
      zoomRef.current = next;
      setZoomDistance(next);
    };

    const domEl = renderer.domElement;
    domEl.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    domEl.addEventListener("wheel", onWheel, { passive: false });

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const w = entry.contentRect.width;
      const h = entry.contentRect.height;
      if (w > 0 && h > 0) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    });
    resizeObserver.observe(container);

    let rafId = 0;
    let t = 0;

    const animate = () => {
      const paused = isPausedRef.current || prefersReduced;

      if (targetTargetRef.current) {
        const diffTheta = Math.atan2(
          Math.sin(targetTargetRef.current.theta - currentTheta),
          Math.cos(targetTargetRef.current.theta - currentTheta)
        );
        currentTheta += diffTheta * 0.06;
        currentPhi += (targetTargetRef.current.phi - currentPhi) * 0.06;
        if (Math.abs(diffTheta) < 0.003 && Math.abs(targetTargetRef.current.phi - currentPhi) < 0.003) {
          targetTargetRef.current = null;
        }
      } else if (!isDragging && !paused) {
        currentTheta += 0.002;
      }

      if (!paused) {
        t += 0.016;
        stars.rotation.y += 0.00025;
        orbitRing.rotation.z += 0.0018;
        orbitRing2.rotation.z -= 0.0014;

        pulseRings.forEach((ring, idx) => {
          const s = 1 + 0.55 * Math.sin(t * 3 + idx * 0.8);
          ring.scale.setScalar(s);
          (ring.material as THREE.MeshBasicMaterial).opacity = 0.9 - 0.6 * ((s - 1) / 0.55);
        });

        if (travelerPlane && flightCurve) {
          const u = (t * 0.24) % 1;
          const pos = flightCurve.getPoint(u);
          const ahead = flightCurve.getPoint(Math.min(1, u + 0.02));
          travelerPlane.position.copy(pos);
          travelerPlane.up.copy(pos.clone().normalize());
          travelerPlane.lookAt(ahead);
        }
      }

      const dist = zoomRef.current;
      camera.position.x = dist * Math.sin(currentPhi) * Math.sin(currentTheta);
      camera.position.y = dist * Math.cos(currentPhi);
      camera.position.z = dist * Math.sin(currentPhi) * Math.cos(currentTheta);
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
      rafId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      domEl.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      domEl.removeEventListener("wheel", onWheel);
      globeTex.dispose();
      globeGeo.dispose();
      globeMat.dispose();
      atmosGeo.dispose();
      atmosMat.dispose();
      orbitRingGeo.dispose();
      orbitRingMat.dispose();
      orbitRing2Geo.dispose();
      orbitRing2Mat.dispose();
      starGeo.dispose();
      starMat.dispose();
      renderer.dispose();
    };
  }, [activeTrip, suggestions]);

  const handleResetView = () => {
    setZoomDistance(3.15);
    zoomRef.current = 3.15;
    if (activeTrip) {
      const vec = latLngToVector3(activeTrip.lat, activeTrip.lng, 1).normalize();
      targetTargetRef.current = {
        phi: Math.acos(THREE.MathUtils.clamp(vec.y, -1, 1)),
        theta: Math.atan2(vec.x, vec.z),
      };
    }
  };

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl bg-[#051224]/75 border border-teal-400/20 shadow-2xl">
      <div
        ref={mountRef}
        className="h-full w-full cursor-grab active:cursor-grabbing touch-pan-y"
        aria-label="Interactive 3D travel globe"
      />

      {/* Top HUD Overlay */}
      <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-2">
        <div className="pointer-events-auto rounded-xl bg-slate-950/75 px-3 py-1.5 backdrop-blur-md border border-amber-400/25">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-200">
            <Plane className="h-3.5 w-3.5 text-amber-400 plane-cruise" />
            <span>
              {activeTrip
                ? `${activeTrip.originCity} ✈ ${activeTrip.destination}, ${activeTrip.country}`
                : "Global 3D Expedition Explorer"}
            </span>
          </div>
          {activeTrip && (
            <p className="mt-0.5 text-[11px] text-teal-200/80 font-mono">
              {activeTrip.lat.toFixed(2)}°N, {activeTrip.lng.toFixed(2)}°E • {activeTrip.daysCount} Days
            </p>
          )}
        </div>

        <div className="pointer-events-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleResetView}
            title="Recenter Globe"
            className="rounded-lg bg-slate-950/75 p-2 text-slate-300 hover:text-amber-300 hover:border-amber-400/45 border border-white/10 backdrop-blur-md transition-colors cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onTogglePause}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-950/75 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:text-amber-300 hover:border-amber-400/45 border border-white/10 backdrop-blur-md transition-colors cursor-pointer"
          >
            {isPaused ? <Play className="h-3.5 w-3.5 text-teal-400" /> : <Pause className="h-3.5 w-3.5 text-amber-400" />}
            <span>{isPaused ? playLabel : pauseLabel}</span>
          </button>
        </div>
      </div>

      {/* Bottom Legend / Suggested Destination Pills */}
      <div className="pointer-events-none absolute inset-x-3 bottom-3 flex flex-wrap items-center justify-between gap-2">
        <div className="pointer-events-auto flex items-center gap-3 rounded-lg bg-slate-950/75 px-2.5 py-1 text-[11px] text-slate-300 backdrop-blur-md border border-white/10">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-teal-400" /> Origin
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-amber-400" /> Destination
          </span>
          <span className="inline-flex items-center gap-1">
            <Compass className="h-3 w-3 text-sky-400" /> Drag & Scroll 3D
          </span>
        </div>

        {suggestions.length > 0 && onSelectSuggestion && (
          <div className="pointer-events-auto flex flex-wrap gap-1.5">
            {suggestions.slice(0, 3).map((s) => (
              <button
                key={s.name}
                type="button"
                onClick={() => onSelectSuggestion(s)}
                className="rounded-full bg-rose-500/20 hover:bg-rose-500/35 border border-rose-400/40 px-2.5 py-1 text-[11px] font-medium text-rose-100 backdrop-blur-md transition-colors cursor-pointer"
              >
                ✦ {s.name} ({s.matchScore}%)
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
