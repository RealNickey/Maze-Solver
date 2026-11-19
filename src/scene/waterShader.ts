import * as THREE from 'three';

/**
 * Realistic stylized pixel-art organic coastal water shader.
 * Combines domain-warped rounded Voronoi pools (matching soft bubbly turquoise pools
 * and undulating cyan/white caustic webs), animated shoreline foam waves,
 * subtle specular sun shimmer, and cerulean horizon reflection.
 */
export function createStylizedWaterMaterial(
  islandHalfW: number,
  islandHalfD: number
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uIslandHalf: { value: new THREE.Vector2(islandHalfW, islandHalfD) },
      uDeepPool: { value: new THREE.Color(0x0586a1) },
      uMidPool: { value: new THREE.Color(0x10a9be) },
      uShallowPool: { value: new THREE.Color(0x28c6d4) },
      uFoamCyan: { value: new THREE.Color(0xcff7ff) },
      uWhiteFoam: { value: new THREE.Color(0xffffff) },
      uHorizonColor: { value: new THREE.Color(0x88c2f8) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldPos;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec2 uIslandHalf;
      uniform vec3 uDeepPool;
      uniform vec3 uMidPool;
      uniform vec3 uShallowPool;
      uniform vec3 uFoamCyan;
      uniform vec3 uWhiteFoam;
      uniform vec3 uHorizonColor;

      varying vec3 vWorldPos;

      vec2 hash22(vec2 p) {
        p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
        return fract(sin(p) * 43758.5453123);
      }

      // Smooth-min rounded Voronoi distance (produces organic bubbly water pools instead of sharp polygons!)
      float smoothVoronoi(vec2 x, float t) {
        vec2 n = floor(x);
        vec2 f = fract(x);
        float res = 0.0;
        for (int j = -1; j <= 1; j++) {
          for (int i = -1; i <= 1; i++) {
            vec2 g = vec2(float(i), float(j));
            vec2 o = hash22(n + g);
            o = 0.5 + 0.36 * sin(t * 0.85 + 6.2831 * o);
            vec2 r = g + o - f;
            float d = length(r);
            res += exp(-6.8 * d);
          }
        }
        return -(1.0 / 6.8) * log(max(res, 0.0001));
      }

      // Signed distance to rounded island plinth rectangle for shoreline depth & foam
      float sdRoundedBox(vec2 p, vec2 b, float r) {
        vec2 q = abs(p) - b + vec2(r);
        return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
      }

      void main() {
        vec2 rawXZ = vWorldPos.xz;
        // Subtle crisp pixel-art quantization grid for authentic dreamy pixel water
        float pixelGrid = 7.0;
        vec2 p = floor(rawXZ * pixelGrid + 0.5) / pixelGrid;

        float t = uTime;

        // Organic undulating fluid domain warp (eliminates straight geometric lines completely!)
        vec2 warp = vec2(
          sin(p.y * 0.58 + t * 0.62) * 0.42 + cos(p.x * 0.36 - t * 0.45) * 0.24,
          cos(p.x * 0.54 - t * 0.58) * 0.42 + sin(p.y * 0.38 + t * 0.48) * 0.24
        );

        vec2 flowA = (p + warp) * 0.38 + vec2(t * 0.08, t * 0.045);
        vec2 flowB = (p - warp * 0.65) * 0.27 - vec2(t * 0.055, -t * 0.07);

        // Rounded organic pool heights (low = deep turquoise pool center, high = buoyant foam ridge)
        float d1 = smoothVoronoi(flowA, t * 0.78);
        float d2 = smoothVoronoi(flowB + vec2(4.1, 2.3), t * 0.58);
        float field = d1 * 0.68 + d2 * 0.32;

        // Shoreline proximity around the stone garden island
        float shoreDist = sdRoundedBox(p, uIslandHalf, 0.55);
        float shallowMask = 1.0 - smoothstep(0.0, 5.5, max(0.0, shoreDist));

        // Layered realistic turquoise water pool shading (deeper edge shadow inside each pool like reference!)
        float deepEdge = smoothstep(0.24, 0.46, d1);
        vec3 waterCol = mix(uMidPool, uDeepPool, deepEdge * 0.72);
        waterCol = mix(waterCol, uShallowPool, shallowMask * 0.58);

        // Soft bubbly ice-cyan caustic web + crisp white sunlit crest along rounded pool rims
        float cyanWeb = smoothstep(0.41, 0.485, field);
        float whiteCrest = smoothstep(0.47, 0.535, field);

        // Delicate scattered pixel foam droplets along web margins
        vec2 speck = hash22(floor(p * pixelGrid));
        float droplets = step(0.91, speck.x) * smoothstep(0.36, 0.47, field);

        // Subtle sunlit water sparkle glints drifting with ripples
        float glintWave = sin(p.x * 1.6 + p.y * 1.1 + t * 1.9) * cos(p.x * 0.9 - p.y * 1.4 - t * 1.4);
        float sunGlint = smoothstep(0.84, 0.96, glintWave) * 0.38;

        vec3 col = waterCol;
        col = mix(col, uFoamCyan, clamp(cyanWeb * 0.86 + droplets * 0.72, 0.0, 1.0));
        col = mix(col, uWhiteFoam, clamp(whiteCrest * 0.94 + sunGlint, 0.0, 1.0));

        // Animated lapping white shoreline foam waves hugging the mossy stone island
        float waveShore = sin(shoreDist * 4.4 - t * 2.2 + sin(p.x * 0.65 + p.y * 0.65)) * 0.5 + 0.5;
        float innerFoam = (1.0 - smoothstep(0.0, 0.78, max(0.0, shoreDist))) * 0.9;
        float rippleFoam = smoothstep(0.7, 0.9, waveShore) * (1.0 - smoothstep(0.25, 2.2, max(0.0, shoreDist))) * 0.62;
        col = mix(col, uWhiteFoam, clamp(innerFoam + rippleFoam, 0.0, 1.0));

        // Realistic Fresnel sky reflection + smooth atmospheric horizon blend
        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        float fresnel = pow(1.0 - max(viewDir.y, 0.0), 2.8);
        col = mix(col, uHorizonColor, clamp(fresnel * 0.36, 0.0, 0.36));

        float distFromCenter = length(vWorldPos.xz);
        float horizonFade = smoothstep(34.0, 78.0, distFromCenter);
        col = mix(col, uHorizonColor, horizonFade);

        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    side: THREE.FrontSide,
  });
}
