import { SandHeightfield } from '../simulation/SandHeightfield';
import { SandPalette } from '../../types/garden';

export interface RGBColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

export function parseColor(str: string): RGBColor {
  str = str.trim();

  // Hex #RGB or #RRGGBB
  if (str.startsWith('#')) {
    const hex = str.slice(1);
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
        a: 1.0
      };
    }
    if (hex.length >= 6) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        a: hex.length >= 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1.0
      };
    }
  }

  // rgb(...) or rgba(...)
  const match = str.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/);
  if (match) {
    return {
      r: parseInt(match[1], 10),
      g: parseInt(match[2], 10),
      b: parseInt(match[3], 10),
      a: match[4] !== undefined ? parseFloat(match[4]) : 1.0
    };
  }

  // Fallback
  return { r: 243, g: 237, b: 226, a: 1.0 };
}

export class SandFieldRenderer {
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext | WebGL2RenderingContext | null = null;
  private isWebGL2 = false;
  private ctx2d: CanvasRenderingContext2D | null = null;

  // WebGL resources
  private program: WebGLProgram | null = null;
  private heightTexture: WebGLTexture | null = null;
  private quadBuffer: WebGLBuffer | null = null;
  private byteBuffer: Uint8Array | null = null;

  // 2D Software Fallback resources
  private imageData: ImageData | null = null;
  private pixels32: Uint32Array | null = null;
  private cachedPaletteId = '';

  constructor() {
    this.canvas = document.createElement('canvas');
    this.initWebGL();
    if (!this.gl) {
      this.initCanvas2D();
    }
  }

  private initWebGL(): void {
    try {
      // 1. Try WebGL2 for native 32-bit float texture support
      const gl2 = this.canvas.getContext('webgl2', {
        alpha: false,
        depth: false,
        stencil: false,
        antialias: false,
        preserveDrawingBuffer: true
      }) as WebGL2RenderingContext | null;

      if (gl2) {
        this.gl = gl2;
        this.isWebGL2 = true;
        this.initShadersWebGL2(gl2);
        return;
      }

      // 2. Fallback to WebGL1
      const gl1 = this.canvas.getContext('webgl', {
        alpha: false,
        depth: false,
        stencil: false,
        antialias: false,
        preserveDrawingBuffer: true
      }) as WebGLRenderingContext | null;

      if (gl1) {
        this.gl = gl1;
        this.isWebGL2 = false;
        this.initShadersWebGL1(gl1);
        return;
      }
    } catch {
      this.gl = null;
    }
  }

  private initCanvas2D(): void {
    this.ctx2d = this.canvas.getContext('2d', { alpha: false });
  }

  private initShadersWebGL2(gl: WebGL2RenderingContext): void {
    const vsSource = `#version 300 es
      in vec2 a_position;
      out vec2 v_uv;
      void main() {
        v_uv = (a_position + 1.0) * 0.5;
        // WebGL Y goes bottom-to-top, canvas 2D top-to-bottom
        v_uv.y = 1.0 - v_uv.y;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    const fsSource = `#version 300 es
      precision highp float;
      uniform sampler2D u_heightmap;
      uniform vec2 u_resolution;
      uniform float u_aspectRatio;
      uniform vec3 u_baseColor;
      uniform vec3 u_grainLight;
      uniform vec3 u_grainDark;
      uniform vec3 u_grooveTrough;
      uniform vec4 u_grooveShadow;
      uniform vec4 u_grooveHighlight;
      in vec2 v_uv;
      out vec4 fragColor;

      // C2-continuous quintic smootherstep sampler for silky smooth surface heights
      float sampleHeight(vec2 uv) {
        vec2 texel = 1.0 / u_resolution;
        vec2 pos = clamp(uv, 0.0, 1.0) * u_resolution - 0.5;
        vec2 f = fract(pos);
        // Perlin quintic smootherstep: 6f^5 - 15f^4 + 10f^3 (zero 1st & 2nd derivatives at edges)
        vec2 s = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
        vec2 b = (floor(pos) + 0.5) * texel;
        float h00 = texture(u_heightmap, b).r;
        float h10 = texture(u_heightmap, b + vec2(texel.x, 0.0)).r;
        float h01 = texture(u_heightmap, b + vec2(0.0, texel.y)).r;
        float h11 = texture(u_heightmap, b + texel).r;
        return mix(mix(h00, h10, s.x), mix(h01, h11, s.x), s.y);
      }

      void main() {
        vec2 texel = 1.0 / u_resolution;
        float h = sampleHeight(v_uv);

        // 1. Surface normal computation via 3x3 Sobel kernel with aspect ratio correction
        // v_uv - vec2(0.0, texel.y) is UP on canvas (-Y)
        // v_uv + vec2(0.0, texel.y) is DOWN on canvas (+Y)
        float hUL = sampleHeight(v_uv + vec2(-texel.x, -texel.y));
        float hU  = sampleHeight(v_uv + vec2( 0.0,     -texel.y));
        float hUR = sampleHeight(v_uv + vec2( texel.x, -texel.y));
        float hL  = sampleHeight(v_uv + vec2(-texel.x,  0.0));
        float hR  = sampleHeight(v_uv + vec2( texel.x,  0.0));
        float hDL = sampleHeight(v_uv + vec2(-texel.x,  texel.y));
        float hD  = sampleHeight(v_uv + vec2( 0.0,      texel.y));
        float hDR = sampleHeight(v_uv + vec2( texel.x,  texel.y));

        float invAspect = 1.0 / max(0.1, u_aspectRatio);
        float dhX = ((hUR + 2.0 * hR + hDR) - (hUL + 2.0 * hL + hDL)) * 0.125 * (u_resolution.x * invAspect);
        float dhY = ((hDL + 2.0 * hD + hDR) - (hUL + 2.0 * hU + hUR)) * 0.125 * u_resolution.y;

        // Gentle, natural bump slope (~30 deg angle of repose for silky Japanese rock garden sand)
        float bump = 0.55;
        vec3 normal = normalize(vec3(-dhX * bump, -dhY * bump, 1.0));

        // 2. Gentle natural daylight from North-West (Upper-Left)
        vec3 lightDir = normalize(vec3(-0.45, -0.55, 0.70));
        float NdotL = dot(normal, lightDir);
        float directDiff = max(0.0, NdotL);
        // Hemispherical wrap daylight: simulates bright outdoor sky illumination
        float wrapDiff = clamp((NdotL + 0.50) / 1.50, 0.0, 1.0);
        // Normalized so unraked flat ground (normal 0,0,1) receives exactly 1.00 baseline daylight
        float flatWrapDiff = (0.7018 + 0.50) / 1.50;
        float diffuseIllum = (0.55 + 0.45 * wrapDiff) / (0.55 + 0.45 * flatWrapDiff);

        // 3. Directional self-shadowing with soft penumbra raymarching:
        // Raymarch along isotropic 2D sunlight direction towards the sun
        vec2 sunDir2D = normalize(vec2(lightDir.x * invAspect, lightDir.y));
        vec2 rayStep = sunDir2D * texel * 2.2;
        float maxOcclusion = 0.0;
        for (int i = 1; i <= 8; i++) {
          float fi = float(i);
          float sH = sampleHeight(v_uv + rayStep * fi);
          float rayRise = h + fi * 0.022;
          float diffH = sH - rayRise;
          if (diffH > 0.0) {
            float occ = clamp(diffH * 14.0, 0.0, 1.0) / (1.0 + fi * 0.40);
            maxOcclusion = max(maxOcclusion, occ);
          }
        }
        float shadow = 1.0 - maxOcclusion * 0.28;

        // 4. Subtle, elegant ambient occlusion in furrows (never dark or muddy)
        float troughDepth = clamp(-h * 2.0, 0.0, 1.0);
        float ao = 1.0 - troughDepth * 0.16;

        // 5. Sand Palette Shading: pristine baseline ivory-cream across flat sand
        vec3 col = u_baseColor;
        if (h < 0.0) {
          // Monotonic valid GLSL smooth transition into warm groove trough
          float troughFactor = 1.0 - smoothstep(-0.30, 0.0, h);
          col = mix(u_baseColor, u_grooveTrough, troughFactor * 0.70);
        } else {
          // Silky transition toward luminous crest tone on ridges
          float ridgeFactor = smoothstep(0.0, 0.16, h);
          col = mix(u_baseColor, u_grainLight, ridgeFactor * 0.75);
        }

        // Illumination combining balanced daylight, soft shadow penumbra, and gentle AO
        vec3 lit = col * (diffuseIllum * shadow) * ao;

        // Delicate crest sun sheen on sunny slopes (smooth Hermite easing, no harsh cutoff)
        if (directDiff > 0.05 && h > 0.005) {
          float crest = smoothstep(0.005, 0.15, h);
          float sunGleam = pow(directDiff, 2.4) * crest * shadow;
          lit = mix(lit, u_grooveHighlight.rgb, sunGleam * u_grooveHighlight.a * 0.45);
        }

        // Soft atmospheric furrow shadow tint (subtle cool/warm depth, no muddy sludge)
        if (shadow < 0.99 && h < -0.01) {
          float furrowWeight = 1.0 - smoothstep(-0.25, -0.01, h);
          float shWeight = (1.0 - shadow) * furrowWeight * u_grooveShadow.a * 0.40;
          lit = mix(lit, u_grooveShadow.rgb, shWeight);
        }

        // 6. Sub-pixel screen-space velvet dither (prevents 8-bit color banding, 100% invisible as noise)
        float dither = (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * (0.8 / 255.0);
        lit += dither;

        fragColor = vec4(clamp(lit, 0.0, 1.0), 1.0);
      }
    `;

    const prog = this.compileProgram(gl, vsSource, fsSource);
    if (!prog) {
      this.gl = null;
      this.initCanvas2D();
      return;
    }

    this.program = prog;
    this.initBuffersAndTextures(gl);
  }

  private initShadersWebGL1(gl: WebGLRenderingContext): void {
    const vsSource = `
      attribute vec2 a_position;
      varying vec2 v_uv;
      void main() {
        v_uv = (a_position + 1.0) * 0.5;
        v_uv.y = 1.0 - v_uv.y;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    const fsSource = `
      precision mediump float;
      uniform sampler2D u_heightmap;
      uniform vec2 u_resolution;
      uniform float u_aspectRatio;
      uniform vec3 u_baseColor;
      uniform vec3 u_grainLight;
      uniform vec3 u_grainDark;
      uniform vec3 u_grooveTrough;
      uniform vec4 u_grooveShadow;
      uniform vec4 u_grooveHighlight;
      varying vec2 v_uv;

      float sampleHeight(vec2 uv) {
        vec2 texel = 1.0 / u_resolution;
        vec2 pos = clamp(uv, 0.0, 1.0) * u_resolution - 0.5;
        vec2 f = fract(pos);
        vec2 s = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
        vec2 b = (floor(pos) + 0.5) * texel;
        float h00 = texture2D(u_heightmap, b).r * 2.0 - 1.0;
        float h10 = texture2D(u_heightmap, b + vec2(texel.x, 0.0)).r * 2.0 - 1.0;
        float h01 = texture2D(u_heightmap, b + vec2(0.0, texel.y)).r * 2.0 - 1.0;
        float h11 = texture2D(u_heightmap, b + texel).r * 2.0 - 1.0;
        return mix(mix(h00, h10, s.x), mix(h01, h11, s.x), s.y);
      }

      void main() {
        vec2 texel = 1.0 / u_resolution;
        float h = sampleHeight(v_uv);

        float hUL = sampleHeight(v_uv + vec2(-texel.x, -texel.y));
        float hU  = sampleHeight(v_uv + vec2( 0.0,     -texel.y));
        float hUR = sampleHeight(v_uv + vec2( texel.x, -texel.y));
        float hL  = sampleHeight(v_uv + vec2(-texel.x,  0.0));
        float hR  = sampleHeight(v_uv + vec2( texel.x,  0.0));
        float hDL = sampleHeight(v_uv + vec2(-texel.x,  texel.y));
        float hD  = sampleHeight(v_uv + vec2( 0.0,      texel.y));
        float hDR = sampleHeight(v_uv + vec2( texel.x,  texel.y));

        float invAspect = 1.0 / max(0.1, u_aspectRatio);
        float dhX = ((hUR + 2.0 * hR + hDR) - (hUL + 2.0 * hL + hDL)) * 0.125 * (u_resolution.x * invAspect);
        float dhY = ((hDL + 2.0 * hD + hDR) - (hUL + 2.0 * hU + hUR)) * 0.125 * u_resolution.y;

        float bump = 0.55;
        vec3 normal = normalize(vec3(-dhX * bump, -dhY * bump, 1.0));

        vec3 lightDir = normalize(vec3(-0.45, -0.55, 0.70));
        float NdotL = dot(normal, lightDir);
        float directDiff = max(0.0, NdotL);
        float wrapDiff = clamp((NdotL + 0.50) / 1.50, 0.0, 1.0);
        float flatWrapDiff = (0.7018 + 0.50) / 1.50;
        float diffuseIllum = (0.55 + 0.45 * wrapDiff) / (0.55 + 0.45 * flatWrapDiff);

        // Soft penumbra raymarch along isotropic sun direction
        vec2 sunDir2D = normalize(vec2(lightDir.x * invAspect, lightDir.y));
        vec2 rayStep = sunDir2D * texel * 2.2;
        float maxOcclusion = 0.0;
        for (int i = 1; i <= 6; i++) {
          float fi = float(i);
          float sH = sampleHeight(v_uv + rayStep * fi);
          float diffH = sH - (h + fi * 0.022);
          if (diffH > 0.0) {
            float occ = clamp(diffH * 14.0, 0.0, 1.0) / (1.0 + fi * 0.40);
            maxOcclusion = max(maxOcclusion, occ);
          }
        }
        float shadow = 1.0 - maxOcclusion * 0.28;

        float troughDepth = clamp(-h * 2.0, 0.0, 1.0);
        float ao = 1.0 - troughDepth * 0.16;

        vec3 col = u_baseColor;
        if (h < 0.0) {
          float troughFactor = clamp(-h * 3.33, 0.0, 1.0);
          col = mix(u_baseColor, u_grooveTrough, troughFactor * 0.70);
        } else {
          float ridgeFactor = clamp(h * 6.25, 0.0, 1.0);
          col = mix(u_baseColor, u_grainLight, ridgeFactor * 0.75);
        }

        vec3 lit = col * (diffuseIllum * shadow) * ao;

        if (directDiff > 0.05 && h > 0.005) {
          float crest = clamp((h - 0.005) * 6.9, 0.0, 1.0);
          float sunGleam = pow(directDiff, 2.4) * crest * shadow;
          lit = mix(lit, u_grooveHighlight.rgb, sunGleam * u_grooveHighlight.a * 0.45);
        }

        if (shadow < 0.99 && h < -0.01) {
          float furrowWeight = clamp((-h - 0.01) * 4.16, 0.0, 1.0);
          float shWeight = (1.0 - shadow) * furrowWeight * u_grooveShadow.a * 0.40;
          lit = mix(lit, u_grooveShadow.rgb, shWeight);
        }

        vec2 grainCoord = v_uv * u_resolution * 0.5;
        float dither = (fract(sin(dot(grainCoord, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * (0.8 / 255.0);
        lit += dither;

        gl_FragColor = vec4(clamp(lit, 0.0, 1.0), 1.0);
      }
    `;

    const prog = this.compileProgram(gl, vsSource, fsSource);
    if (!prog) {
      this.gl = null;
      this.initCanvas2D();
      return;
    }

    this.program = prog;
    this.initBuffersAndTextures(gl);
  }

  private compileProgram(
    gl: WebGLRenderingContext | WebGL2RenderingContext,
    vsSrc: string,
    fsSrc: string
  ): WebGLProgram | null {
    const vs = gl.createShader(gl.VERTEX_SHADER);
    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    if (!vs || !fs) return null;

    gl.shaderSource(vs, vsSrc);
    gl.compileShader(vs);
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
      console.warn('VS compile error:', gl.getShaderInfoLog(vs));
      return null;
    }

    gl.shaderSource(fs, fsSrc);
    gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      console.warn('FS compile error:', gl.getShaderInfoLog(fs));
      return null;
    }

    const prog = gl.createProgram();
    if (!prog) return null;

    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);

    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn('Program link error:', gl.getProgramInfoLog(prog));
      return null;
    }

    return prog;
  }

  private initBuffersAndTextures(gl: WebGLRenderingContext | WebGL2RenderingContext): void {
    const quad = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
      -1,  1,
       1, -1,
       1,  1
    ]);
    this.quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);

    this.heightTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.heightTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  }

  /**
   * Main render call: renders the heightfield onto target 2D context
   */
  public render(
    targetCtx: CanvasRenderingContext2D,
    heightfield: SandHeightfield,
    width: number,
    height: number,
    palette: SandPalette,
    dpr = 1
  ): void {
    targetCtx.imageSmoothingEnabled = true;
    targetCtx.imageSmoothingQuality = 'high';

    if (this.gl && this.program) {
      this.renderWebGL(heightfield, width, height, palette, dpr);
      targetCtx.drawImage(this.canvas, 0, 0, width, height);
    } else {
      this.renderCanvas2D(heightfield, width, height, palette);
      targetCtx.drawImage(this.canvas, 0, 0, width, height);
    }
  }

  /**
   * WebGL Render Path
   */
  private renderWebGL(
    heightfield: SandHeightfield,
    width: number,
    height: number,
    palette: SandPalette,
    dpr = 1
  ): void {
    const gl = this.gl;
    const prog = this.program;
    if (!gl || !prog) return;

    const fw = heightfield.width;
    const fh = heightfield.height;

    // Use native device pixel resolution for crisp High-DPI sand rendering
    const renderW = Math.max(1, Math.round(width * dpr));
    const renderH = Math.max(1, Math.round(height * dpr));

    if (this.canvas.width !== renderW || this.canvas.height !== renderH) {
      this.canvas.width = renderW;
      this.canvas.height = renderH;
      gl.viewport(0, 0, renderW, renderH);
      if (!this.isWebGL2) {
        this.byteBuffer = new Uint8Array(fw * fh);
      }
    }

    this.uploadHeightTexture(heightfield);

    gl.useProgram(prog);

    // Uniforms
    gl.uniform2f(gl.getUniformLocation(prog, 'u_resolution'), fw, fh);
    gl.uniform1f(gl.getUniformLocation(prog, 'u_aspectRatio'), heightfield.getAspectRatio());

    const baseRGB = parseColor(palette.baseColor);
    const grainLightRGB = parseColor(palette.grainLight);
    const grainDarkRGB = parseColor(palette.grainDark);
    const troughRGB = parseColor(palette.grooveTrough);
    const shadowRGB = parseColor(palette.grooveShadow);
    const highlightRGB = parseColor(palette.grooveHighlight);

    gl.uniform3f(gl.getUniformLocation(prog, 'u_baseColor'), baseRGB.r / 255, baseRGB.g / 255, baseRGB.b / 255);
    gl.uniform3f(gl.getUniformLocation(prog, 'u_grainLight'), grainLightRGB.r / 255, grainLightRGB.g / 255, grainLightRGB.b / 255);
    gl.uniform3f(gl.getUniformLocation(prog, 'u_grainDark'), grainDarkRGB.r / 255, grainDarkRGB.g / 255, grainDarkRGB.b / 255);
    gl.uniform3f(gl.getUniformLocation(prog, 'u_grooveTrough'), troughRGB.r / 255, troughRGB.g / 255, troughRGB.b / 255);
    gl.uniform4f(gl.getUniformLocation(prog, 'u_grooveShadow'), shadowRGB.r / 255, shadowRGB.g / 255, shadowRGB.b / 255, shadowRGB.a);
    gl.uniform4f(gl.getUniformLocation(prog, 'u_grooveHighlight'), highlightRGB.r / 255, highlightRGB.g / 255, highlightRGB.b / 255, highlightRGB.a);

    // Bind texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.heightTexture);
    gl.uniform1i(gl.getUniformLocation(prog, 'u_heightmap'), 0);

    // Bind quad vertex buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    const aPos = gl.getAttribLocation(prog, 'a_position');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  private uploadHeightTexture(heightfield: SandHeightfield): void {
    const gl = this.gl;
    if (!gl || !this.heightTexture) return;

    const w = heightfield.width;
    const h = heightfield.height;
    const heights = heightfield.heights;

    gl.bindTexture(gl.TEXTURE_2D, this.heightTexture);

    if (this.isWebGL2) {
      const gl2 = gl as WebGL2RenderingContext;
      // Direct 32-bit float upload - Zero CPU packing overhead
      gl2.texImage2D(gl2.TEXTURE_2D, 0, gl2.R32F, w, h, 0, gl2.RED, gl2.FLOAT, heights);
    } else {
      // WebGL1 single 8-bit channel fallback
      if (!this.byteBuffer || this.byteBuffer.length !== w * h) {
        this.byteBuffer = new Uint8Array(w * h);
      }
      const bytes = this.byteBuffer;
      const total = w * h;
      for (let i = 0; i < total; i++) {
        const val = heights[i];
        const cl = val < -1.0 ? -1.0 : val > 1.0 ? 1.0 : val;
        bytes[i] = Math.floor((cl + 1.0) * 0.5 * 255);
      }
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, w, h, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, bytes);
    }
  }

  /**
   * High-Performance Canvas 2D Software Fallback Path with Dirty Rectangle Acceleration
   */
  private renderCanvas2D(
    heightfield: SandHeightfield,
    width: number,
    height: number,
    palette: SandPalette
  ): void {
    const fw = heightfield.width;
    const fh = heightfield.height;

    if (!this.ctx2d) {
      this.initCanvas2D();
      if (!this.ctx2d) return;
    }

    const sizeChanged = this.canvas.width !== fw || this.canvas.height !== fh;
    const paletteChanged = this.cachedPaletteId !== palette.id;

    if (sizeChanged || !this.imageData) {
      this.canvas.width = fw;
      this.canvas.height = fh;
      this.imageData = this.ctx2d.createImageData(fw, fh);
      this.pixels32 = new Uint32Array(this.imageData.data.buffer);
    }

    this.cachedPaletteId = palette.id;

    const pixels = this.pixels32!;
    const heights = heightfield.heights;

    const base = parseColor(palette.baseColor);
    const light = parseColor(palette.grainLight);
    const dark = parseColor(palette.grainDark);
    const trough = parseColor(palette.grooveTrough);
    const shadow = parseColor(palette.grooveShadow);
    const highlight = parseColor(palette.grooveHighlight);

    const bump = 0.55;
    // Light direction (-0.45, -0.55, 0.70) normalized
    const lx = -0.45;
    const ly = -0.55;
    const lz = 0.70;
    const lLen = Math.hypot(lx, ly, lz);
    const nlx = lx / lLen;
    const nly = ly / lLen;
    const nlz = lz / lLen;
    const invAspect = 1.0 / Math.max(0.1, heightfield.getAspectRatio());
    const flatWrapDiff = (0.7018 + 0.50) / 1.50;

    const dirty = heightfield.getDirtyRect();
    const isFull = sizeChanged || paletteChanged || !dirty;

    const minX = isFull ? 1 : Math.max(1, dirty.minX - 1);
    const maxX = isFull ? fw - 2 : Math.min(fw - 2, dirty.maxX + 1);
    const minY = isFull ? 1 : Math.max(1, dirty.minY - 1);
    const maxY = isFull ? fh - 2 : Math.min(fh - 2, dirty.maxY + 1);

    for (let y = minY; y <= maxY; y++) {
      const row = y * fw;
      for (let x = minX; x <= maxX; x++) {
        const idx = row + x;
        const hVal = heights[idx];

        // 3x3 Sobel filtered gradient with aspect ratio correction
        const hUL = heights[idx - fw - 1];
        const hU  = heights[idx - fw];
        const hUR = heights[idx - fw + 1];
        const hL  = heights[idx - 1];
        const hR  = heights[idx + 1];
        const hDL = heights[idx + fw - 1];
        const hD  = heights[idx + fw];
        const hDR = heights[idx + fw + 1];

        const dhX = ((hUR + 2 * hR + hDR) - (hUL + 2 * hL + hDL)) * 0.125 * (fw * invAspect);
        const dhY = ((hDL + 2 * hD + hDR) - (hUL + 2 * hU + hUR)) * 0.125 * fh;

        const nx = -dhX * bump;
        const ny = -dhY * bump;
        const nz = 1.0;
        const nLen = Math.hypot(nx, ny, nz) || 1;

        const dot = (nx * nlx + ny * nly + nz * nlz) / nLen;
        const directDiff = dot > 0 ? dot : 0;
        const wrapDiff = Math.max(0, Math.min(1, (dot + 0.50) / 1.50));
        const diffuseIllum = (0.55 + 0.45 * wrapDiff) / (0.55 + 0.45 * flatWrapDiff);

        // Smooth ambient occlusion
        const troughDepth = Math.max(0, Math.min(1, -hVal * 2.0));
        const ao = 1.0 - troughDepth * 0.16;

        // Soft continuous penumbra berm self-shadowing towards sun
        let maxOcc = 0;
        const sDirX = nlx * invAspect;
        const sDirY = nly;
        const sLen = Math.hypot(sDirX, sDirY) || 1;
        const stepNormX = sDirX / sLen;
        const stepNormY = sDirY / sLen;

        for (let i = 1; i <= 3; i++) {
          const sStepX = Math.round(stepNormX * i * 2.2);
          const sStepY = Math.round(stepNormY * i * 2.2);
          const sIdx = (y + sStepY) * fw + (x + sStepX);
          if (sIdx >= 0 && sIdx < heights.length) {
            const clearH = hVal + i * 0.022;
            if (heights[sIdx] > clearH) {
              const occ = Math.min(1.0, (heights[sIdx] - clearH) * 14.0) / (1.0 + i * 0.40);
              if (occ > maxOcc) maxOcc = occ;
            }
          }
        }
        const shadowFactor = 1.0 - maxOcc * 0.28;

        // Color interpolation with pristine base color for flat sand
        let r = base.r;
        let g = base.g;
        let b = base.b;

        if (hVal < 0) {
          const t = Math.min(1.0, Math.max(0.0, -hVal * 3.33)) * 0.70;
          r = r + (trough.r - r) * t;
          g = g + (trough.g - g) * t;
          b = b + (trough.b - b) * t;
        } else {
          const t = Math.min(1.0, Math.max(0.0, hVal * 6.25)) * 0.75;
          r = r + (light.r - r) * t;
          g = g + (light.g - g) * t;
          b = b + (light.b - b) * t;
        }

        // Illumination
        const lightFactor = diffuseIllum * shadowFactor * ao;
        r *= lightFactor;
        g *= lightFactor;
        b *= lightFactor;

        // Ridge crest sheen
        if (directDiff > 0.05 && hVal > 0.005) {
          const crest = Math.min(1.0, Math.max(0.0, (hVal - 0.005) * 6.9));
          const hiWeight = Math.min(1.0, Math.pow(directDiff, 2.4) * crest) * highlight.a * shadowFactor * 0.45;
          r = r + (highlight.r - r) * hiWeight;
          g = g + (highlight.g - g) * hiWeight;
          b = b + (highlight.b - b) * hiWeight;
        }

        // Trough shadow tint
        if (shadowFactor < 0.99 && hVal < -0.01) {
          const furrowWeight = Math.min(1.0, Math.max(0.0, (-hVal - 0.01) * 4.16));
          const shWeight = (1.0 - shadowFactor) * furrowWeight * shadow.a * 0.40;
          r = r + (shadow.r - r) * shWeight;
          g = g + (shadow.g - g) * shWeight;
          b = b + (shadow.b - b) * shWeight;
        }

        // Clean sub-pixel dither to eliminate 8-bit banding without static grain
        const grain = (((x * 37 + y * 73) & 3) - 1.5) * 0.35;
        r = Math.max(0, Math.min(255, Math.round(r + grain)));
        g = Math.max(0, Math.min(255, Math.round(g + grain)));
        b = Math.max(0, Math.min(255, Math.round(b + grain)));

        // Little-endian RGBA packing: 0xAABBGGRR
        pixels[idx] = (255 << 24) | (b << 16) | (g << 8) | r;
      }
    }

    heightfield.clearDirty();

    if (isFull) {
      this.ctx2d.putImageData(this.imageData, 0, 0);
    } else {
      const dW = maxX - minX + 1;
      const dH = maxY - minY + 1;
      this.ctx2d.putImageData(this.imageData, 0, 0, minX, minY, dW, dH);
    }
  }

  public getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }
}
