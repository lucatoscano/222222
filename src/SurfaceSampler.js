import * as THREE from "three";
import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

function spreadBits(value) {
  let x = value & 0x3ff;
  x = (x | (x << 16)) & 0x030000ff;
  x = (x | (x << 8)) & 0x0300f00f;
  x = (x | (x << 4)) & 0x030c30c3;
  x = (x | (x << 2)) & 0x09249249;
  return x;
}

function mortonKey(x, y, z) {
  return (
    (spreadBits(x) << 2) |
    (spreadBits(y) << 1) |
    spreadBits(z)
  ) >>> 0;
}

function orderSpatially(positions) {
  const count = positions.length / 3;
  const keys = new Uint32Array(count);
  let order = new Uint32Array(count);
  let scratch = new Uint32Array(count);

  for (let i = 0; i < count; i++) {
    const x = THREE.MathUtils.clamp(
      Math.round((positions[i * 3] * 0.5 + 0.5) * 1023),
      0,
      1023
    );
    const y = THREE.MathUtils.clamp(
      Math.round((positions[i * 3 + 1] * 0.5 + 0.5) * 1023),
      0,
      1023
    );
    const z = THREE.MathUtils.clamp(
      Math.round((positions[i * 3 + 2] * 0.5 + 0.5) * 1023),
      0,
      1023
    );

    keys[i] = mortonKey(x, y, z);
    order[i] = i;
  }

  // Radix sort O(n): molto più rapido del sort con comparatore su 300.000 punti.
  for (let shift = 0; shift < 30; shift += 10) {
    const buckets = new Uint32Array(1024);

    for (let i = 0; i < count; i++) {
      buckets[(keys[order[i]] >>> shift) & 1023]++;
    }

    let offset = 0;
    for (let i = 0; i < buckets.length; i++) {
      const bucketSize = buckets[i];
      buckets[i] = offset;
      offset += bucketSize;
    }

    for (let i = 0; i < count; i++) {
      const index = order[i];
      const bucket = (keys[index] >>> shift) & 1023;
      scratch[buckets[bucket]++] = index;
    }

    [order, scratch] = [scratch, order];
  }

  const ordered = new Float32Array(positions.length);
  for (let i = 0; i < count; i++) {
    const source = order[i] * 3;
    const target = i * 3;
    ordered[target] = positions[source];
    ordered[target + 1] = positions[source + 1];
    ordered[target + 2] = positions[source + 2];
  }

  return ordered;
}

function mergeObjectMeshes(object) {
  object.updateMatrixWorld(true);
  const geometries = [];

  object.traverse((child) => {
    if (!child.isMesh || !child.geometry?.getAttribute("position")) return;

    const source = child.geometry.index
      ? child.geometry.toNonIndexed()
      : child.geometry.clone();

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", source.getAttribute("position").clone());
    geometry.applyMatrix4(child.matrixWorld);
    geometries.push(geometry);
    source.dispose();
  });

  if (!geometries.length) {
    throw new Error("L'OBJ non contiene nessuna mesh campionabile.");
  }

  const merged = mergeGeometries(geometries, false);
  geometries.forEach((geometry) => geometry.dispose());
  return merged;
}

export default class SurfaceSampler {
  static sample(object, count = 300000) {
    const geometry = mergeObjectMeshes(object);

    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const scale = 2 / Math.max(size.x, size.y, size.z);

    geometry.translate(-center.x, -center.y, -center.z);
    geometry.scale(scale, scale, scale);

    const mesh = new THREE.Mesh(geometry);
    const sampler = new MeshSurfaceSampler(mesh).build();
    const positions = new Float32Array(count * 3);
    const point = new THREE.Vector3();

    for (let i = 0; i < count; i++) {
      sampler.sample(point);
      positions[i * 3] = point.x;
      positions[i * 3 + 1] = point.y;
      positions[i * 3 + 2] = point.z;
    }

    geometry.dispose();
    return orderSpatially(positions);
  }
}
