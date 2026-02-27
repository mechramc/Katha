/**
 * Globe.jsx — Living Memory Globe
 *
 * Three.js 3D visualization of family memories as orbital dots on a translucent sphere.
 * Each dot is sized by emotionalWeight, colored by lifeTheme, and distinguished
 * visually by memory type (recorded = pulsing, reconstructed = faded with ring).
 *
 * Uses Three.js directly (no react-three-fiber) for minimal dependencies.
 * All Three.js resources are cleaned up on unmount.
 */

import React, { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import MemoryCard from './MemoryCard';

/* ─── Constants ──────────────────────────────────────────────────── */

const GLOBE_RADIUS = 1.6;
const BG_COLOR = 0x0a0a1a;
const GLOBE_COLOR = 0x2a3a5c;
const RING_COLOR = 0x1a2a4a;
const GLOBE_OPACITY = 0.08;
const GLOBE_WIREFRAME_OPACITY = 0.12;
const AUTO_ROTATE_SPEED = 0.001;
const PULSE_SPEED = 2.5;
const PULSE_AMPLITUDE = 0.18;
const HOVER_SCALE = 1.35;
const DOT_SEGMENTS = 24;

/* ─── Utility: golden ratio spiral distribution on sphere ──────── */

/**
 * Distribute N points evenly on a sphere surface using the golden ratio spiral.
 * Returns array of THREE.Vector3 positions at the given radius.
 *
 * @param {number} count - Number of points.
 * @param {number} radius - Sphere radius.
 * @returns {THREE.Vector3[]}
 */
function goldenSpiralPositions(count, radius) {
  const positions = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1 || 1)) * 2;
    const radiusAtY = Math.sqrt(1 - y * y);
    const theta = goldenAngle * i;
    const x = Math.cos(theta) * radiusAtY;
    const z = Math.sin(theta) * radiusAtY;
    positions.push(new THREE.Vector3(x * radius, y * radius, z * radius));
  }

  return positions;
}

/* ─── Utility: radial glow texture for sprites ──────────────────────── */

let _glowTexture = null;
function getGlowTexture() {
  if (_glowTexture) return _glowTexture;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const center = size / 2;
  const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.3, 'rgba(255,255,255,0.5)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  _glowTexture = new THREE.CanvasTexture(canvas);
  return _glowTexture;
}

/* ─── Utility: create dashed ring geometry for reconstructed memories ── */

function createDashedRing(radius, color) {
  const points = [];
  const segments = 64;
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0));
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineDashedMaterial({
    color,
    dashSize: 0.03,
    gapSize: 0.02,
    linewidth: 1,
    transparent: true,
    opacity: 0.5,
  });
  const line = new THREE.Line(geometry, material);
  line.computeLineDistances();
  return line;
}

/* ─── Utility: create orbital ring around globe ────────────────── */

function createOrbitalRing(radius, tiltX, tiltY, color, opacity) {
  const curve = new THREE.EllipseCurve(0, 0, radius, radius, 0, Math.PI * 2, false, 0);
  const pts = curve.getPoints(128);
  const geometry = new THREE.BufferGeometry().setFromPoints(
    pts.map((p) => new THREE.Vector3(p.x, p.y, 0))
  );
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
  });
  const ring = new THREE.Line(geometry, material);
  ring.rotation.x = tiltX;
  ring.rotation.y = tiltY;
  return ring;
}

/* ─── OrbitControls (minimal inline, avoids extra import) ──────── */

class SimpleOrbitControls {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;
    this.spherical = new THREE.Spherical();
    this.sphericalDelta = new THREE.Spherical();
    this.target = new THREE.Vector3();
    this.rotateSpeed = 0.6;
    this.zoomSpeed = 1.0;
    this.minDistance = 2.5;
    this.maxDistance = 8;
    this.enabled = true;

    this._isDragging = false;
    this._prevMouse = { x: 0, y: 0 };

    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);
    this._onWheel = this._onWheel.bind(this);

    domElement.addEventListener('mousedown', this._onMouseDown);
    domElement.addEventListener('mousemove', this._onMouseMove);
    domElement.addEventListener('mouseup', this._onMouseUp);
    domElement.addEventListener('mouseleave', this._onMouseUp);
    domElement.addEventListener('wheel', this._onWheel, { passive: false });

    // Initialize spherical from camera position
    const offset = camera.position.clone().sub(this.target);
    this.spherical.setFromVector3(offset);
  }

  _onMouseDown(e) {
    if (!this.enabled || e.button !== 0) return;
    this._isDragging = true;
    this._prevMouse.x = e.clientX;
    this._prevMouse.y = e.clientY;
  }

  _onMouseMove(e) {
    if (!this._isDragging || !this.enabled) return;
    const dx = e.clientX - this._prevMouse.x;
    const dy = e.clientY - this._prevMouse.y;
    this._prevMouse.x = e.clientX;
    this._prevMouse.y = e.clientY;

    this.spherical.theta -= dx * this.rotateSpeed * 0.01;
    this.spherical.phi -= dy * this.rotateSpeed * 0.01;
    this.spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, this.spherical.phi));
  }

  _onMouseUp() {
    this._isDragging = false;
  }

  _onWheel(e) {
    if (!this.enabled) return;
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.05 : 0.95;
    this.spherical.radius = Math.max(
      this.minDistance,
      Math.min(this.maxDistance, this.spherical.radius * factor)
    );
  }

  get isDragging() {
    return this._isDragging;
  }

  update() {
    const offset = new THREE.Vector3().setFromSpherical(this.spherical);
    this.camera.position.copy(this.target).add(offset);
    this.camera.lookAt(this.target);
  }

  dispose() {
    this.domElement.removeEventListener('mousedown', this._onMouseDown);
    this.domElement.removeEventListener('mousemove', this._onMouseMove);
    this.domElement.removeEventListener('mouseup', this._onMouseUp);
    this.domElement.removeEventListener('mouseleave', this._onMouseUp);
    this.domElement.removeEventListener('wheel', this._onWheel);
  }
}

/* ─── Globe Component ──────────────────────────────────────────── */

/**
 * Globe — Living Memory Globe visualization.
 *
 * @param {Object} props
 * @param {Array} props.memories - Array of globe-ready memory objects.
 * @param {Function} props.onMemorySelect - Callback when a memory dot is clicked.
 * @param {string} props.selectedMemoryId - Currently selected memory ID.
 */
export default function Globe({ memories = [], onMemorySelect, selectedMemoryId }) {
  const containerRef = useRef(null);
  const threeRef = useRef(null);
  const hoveredRef = useRef(null);
  const pinnedRef = useRef(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const cardPositionRef = useRef({ x: 0, y: 0 });

  const [hoveredMemory, setHoveredMemory] = React.useState(null);
  const [pinnedMemory, setPinnedMemory] = React.useState(null);
  const [cardPosition, setCardPosition] = React.useState({ x: 0, y: 0 });

  // Keep refs in sync with state for use inside animation loop
  useEffect(() => { hoveredRef.current = hoveredMemory; }, [hoveredMemory]);
  useEffect(() => { pinnedRef.current = pinnedMemory; }, [pinnedMemory]);

  // Sync selectedMemoryId prop to pinned state
  useEffect(() => {
    if (selectedMemoryId && memories.length > 0) {
      const mem = memories.find((m) => m.memoryId === selectedMemoryId);
      if (mem) setPinnedMemory(mem);
    }
  }, [selectedMemoryId, memories]);

  /* ─── Mouse tracking for raycasting ────────────────────────── */

  const handleMouseMove = useCallback((e) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    cardPositionRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const handleClick = useCallback((e) => {
    if (threeRef.current?.controls?.isDragging) return;

    if (hoveredRef.current) {
      setPinnedMemory(hoveredRef.current);
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        setCardPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }
      if (onMemorySelect) onMemorySelect(hoveredRef.current);
    } else {
      setPinnedMemory(null);
    }
  }, [onMemorySelect]);

  /* ─── Three.js initialization and animation ────────────────── */

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // ── Renderer ──
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(BG_COLOR, 1);
    container.appendChild(renderer.domElement);

    // ── Scene ──
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(BG_COLOR, 0.06);

    // ── Camera ──
    const camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    camera.position.set(0, 0.5, 4.5);

    // ── Orbit Controls ──
    const controls = new SimpleOrbitControls(camera, renderer.domElement);

    // ── Lighting ──
    const ambientLight = new THREE.AmbientLight(0x334466, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xaabbff, 0.8);
    dirLight.position.set(3, 5, 4);
    scene.add(dirLight);

    const rimLight = new THREE.DirectionalLight(0x6644aa, 0.3);
    rimLight.position.set(-3, -2, -4);
    scene.add(rimLight);

    // ── Inner glow (point light at center) ──
    const coreGlow = new THREE.PointLight(0x334477, 0.4, 5);
    coreGlow.position.set(0, 0, 0);
    scene.add(coreGlow);

    // ── Globe sphere (translucent, wireframe overlay) ──
    const globeGeometry = new THREE.SphereGeometry(GLOBE_RADIUS, 48, 48);

    const globeSolid = new THREE.Mesh(
      globeGeometry,
      new THREE.MeshPhongMaterial({
        color: GLOBE_COLOR,
        transparent: true,
        opacity: GLOBE_OPACITY,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    scene.add(globeSolid);

    const globeWire = new THREE.Mesh(
      globeGeometry.clone(),
      new THREE.MeshBasicMaterial({
        color: GLOBE_COLOR,
        transparent: true,
        opacity: GLOBE_WIREFRAME_OPACITY,
        wireframe: true,
        depthWrite: false,
      })
    );
    scene.add(globeWire);

    // ── Orbital rings ──
    const ring1 = createOrbitalRing(GLOBE_RADIUS + 0.05, Math.PI * 0.45, 0.2, RING_COLOR, 0.15);
    const ring2 = createOrbitalRing(GLOBE_RADIUS + 0.1, Math.PI * 0.55, -0.3, RING_COLOR, 0.10);
    const ring3 = createOrbitalRing(GLOBE_RADIUS + 0.15, Math.PI * 0.35, 0.5, RING_COLOR, 0.07);
    scene.add(ring1, ring2, ring3);

    // ── Star field background ──
    const starsGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(600 * 3);
    for (let i = 0; i < 600; i++) {
      const r = 15 + Math.random() * 25;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      starPositions[i * 3 + 2] = r * Math.cos(phi);
    }
    starsGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starsMaterial = new THREE.PointsMaterial({
      color: 0x8899bb,
      size: 0.06,
      transparent: true,
      opacity: 0.6,
      sizeAttenuation: true,
    });
    const stars = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(stars);

    // ── Memory dots group ──
    const dotsGroup = new THREE.Group();
    scene.add(dotsGroup);

    // Raycaster
    const raycaster = new THREE.Raycaster();
    raycaster.params.Mesh = { threshold: 0.05 };
    const rayMouse = new THREE.Vector2();

    // Store references for animation + cleanup
    threeRef.current = {
      renderer,
      scene,
      camera,
      controls,
      dotsGroup,
      raycaster,
      rayMouse,
      globeSolid,
      globeWire,
      rings: [ring1, ring2, ring3],
      stars,
      dotMeshes: [],
      ringMeshes: [],
      animId: null,
    };

    // ── Resize handler ──
    function onResize() {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    window.addEventListener('resize', onResize);

    // ── Animation loop ──
    let time = 0;

    function animate() {
      threeRef.current.animId = requestAnimationFrame(animate);
      time += 0.016;

      // Auto-rotation (gentle)
      if (!controls.isDragging) {
        controls.spherical.theta += AUTO_ROTATE_SPEED;
      }
      controls.update();

      // Pulse animation for recorded memory dots
      const dotMeshes = threeRef.current.dotMeshes;
      for (let i = 0; i < dotMeshes.length; i++) {
        const entry = dotMeshes[i];
        if (!entry) continue;
        const { mesh, memory: mem, baseScale } = entry;
        if (mem.pulseActive) {
          const pulse = 1.0 + Math.sin(time * PULSE_SPEED + i * 0.7) * PULSE_AMPLITUDE;
          mesh.scale.setScalar(baseScale * pulse);
        }
      }

      // Raycasting for hover detection
      rayMouse.set(mouseRef.current.x, mouseRef.current.y);
      raycaster.setFromCamera(rayMouse, camera);
      const meshes = dotMeshes.map((d) => d.mesh);
      const intersects = raycaster.intersectObjects(meshes, false);

      let newHovered = null;
      if (intersects.length > 0) {
        const hit = intersects[0].object;
        const entry = dotMeshes.find((d) => d.mesh === hit);
        if (entry) {
          newHovered = entry.memory;
          renderer.domElement.style.cursor = 'pointer';
        }
      } else {
        renderer.domElement.style.cursor = 'default';
      }

      // Update hover state (only if not pinned to something else)
      if (newHovered !== hoveredRef.current) {
        setHoveredMemory(newHovered);
        if (newHovered && !pinnedRef.current) {
          setCardPosition({ ...cardPositionRef.current });
        }
      }

      // Orbital ring slow rotation
      ring1.rotation.z = time * 0.03;
      ring2.rotation.z = -time * 0.02;
      ring3.rotation.z = time * 0.015;

      renderer.render(scene, camera);
    }

    animate();

    // ── Cleanup ──
    return () => {
      window.removeEventListener('resize', onResize);
      if (threeRef.current?.animId) {
        cancelAnimationFrame(threeRef.current.animId);
      }
      controls.dispose();

      // Dispose all geometries and materials
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });

      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }

      threeRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── Update memory dots when memories array changes ───────── */

  useEffect(() => {
    const three = threeRef.current;
    if (!three) return;
    const { dotsGroup } = three;

    // Clear existing dots
    while (dotsGroup.children.length > 0) {
      const child = dotsGroup.children[0];
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
      dotsGroup.remove(child);
    }
    three.dotMeshes = [];
    three.ringMeshes = [];

    if (memories.length === 0) return;

    const positions = goldenSpiralPositions(memories.length, GLOBE_RADIUS + 0.02);

    memories.forEach((mem, i) => {
      const pos = positions[i];
      const color = new THREE.Color(mem.color);

      // Main dot sphere
      const geometry = new THREE.SphereGeometry(mem.size, DOT_SEGMENTS, DOT_SEGMENTS);
      const material = new THREE.MeshPhongMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.35,
        transparent: true,
        opacity: mem.opacity,
        shininess: 80,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(pos);
      dotsGroup.add(mesh);

      const baseScale = 1.0;
      three.dotMeshes.push({ mesh, memory: mem, baseScale });

      // Glow sprite behind each dot (radial gradient texture avoids visible square)
      const spriteMaterial = new THREE.SpriteMaterial({
        map: getGlowTexture(),
        color,
        transparent: true,
        opacity: mem.opacity * 0.25,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(spriteMaterial);
      sprite.position.copy(pos);
      sprite.scale.setScalar(mem.size * 4);
      dotsGroup.add(sprite);

      // Dashed ring for reconstructed memories
      if (mem.memoryType !== 'recorded') {
        const ring = createDashedRing(mem.size * 1.8, color);
        ring.position.copy(pos);
        // Orient ring to face outward from globe center
        ring.lookAt(new THREE.Vector3(0, 0, 0));
        dotsGroup.add(ring);
        three.ringMeshes.push(ring);
      }
    });
  }, [memories]);

  /* ─── Render ───────────────────────────────────────────────── */

  const activeMemory = pinnedMemory || hoveredMemory;
  const isPinned = !!pinnedMemory;

  return (
    <div className="relative w-full h-full min-h-[400px]" style={{ background: '#0a0a1a' }}>
      <div
        ref={containerRef}
        className="w-full h-full"
        onMouseMove={handleMouseMove}
        onClick={handleClick}
      />

      {/* Loading / empty state overlay */}
      {memories.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-gray-500 text-sm">
            No memories loaded. Ingest a persona to populate the globe.
          </p>
        </div>
      )}

      {/* Memory count indicator */}
      {memories.length > 0 && (
        <div className="absolute top-3 left-3 pointer-events-none">
          <span className="text-xs text-gray-500 bg-black/40 backdrop-blur-sm px-2 py-1 rounded">
            {memories.length} memor{memories.length === 1 ? 'y' : 'ies'}
          </span>
        </div>
      )}

      {/* Memory card overlay */}
      <MemoryCard
        memory={activeMemory}
        position={cardPosition}
        visible={!!activeMemory}
        pinned={isPinned}
      />
    </div>
  );
}
