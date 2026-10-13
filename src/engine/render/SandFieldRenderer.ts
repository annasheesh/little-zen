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
      uniform vec3 u_baseColor;
      uniform vec3 u_grainLight;
      uniform vec3 u_grainDark;
      uniform vec3 u_grooveTrough;
      uniform vec4 u_grooveShadow;
      uniform vec4 u_grooveHighlight;
      in vec2 v_uv;
      out vec4 fragColor;

      // Robust bilinear sampler for float texture
      float sampleHeight(vec2 uv) {
        vec2 texel = 1.0 / u_resolution;
        vec2 pos = uv * u_resolution - 0.5;
        vec2 f = fract(pos);
        vec2 b = (floor(pos) + 0.5) * texel;
        float h00 = texture(u_heightmap, b).r;
        float h10 = texture(u_heightmap, b + vec2(texel.x, 0.0)).r;
        float h01 = texture(u_heightmap, b + vec2(0.0, texel.y)).r;
        float h11 = texture(u_heightmap, b + texel).r;
        return mix(mix(h00, h10, f.x), mix(h01, h11, f.x), f.y);
      }

      void main() {
        vec2 texel = 1.0 / u_resolution;
        float h = sampleHeight(v_uv);

        // 1. Surface normal computation via central difference
        // v_uv - vec2(0.0, texel.y) is UP on canvas (-Y)
        // v_uv + vec2(0.0, texel.y) is DOWN on canvas (+Y)
        float hL = sampleHeight(v_uv - vec2(texel.x, 0.0));
        float hR = sampleHeight(v_uv + vec2(texel.x, 0.0));
        float hU = sampleHeight(v_uv - vec2(0.0, texel.y));
        float hD = sampleHeight(v_uv + vec2(0.0, texel.y));

        float dhX = (hR - hL) * 0.5 * u_resolution.x;
        float dhY = (hD - hU) * 0.5 * u_resolution.y;

        float bump = 5.2;
        vec3 normal = normalize(vec3(-dhX * bump, -dhY * bump, 1.0));

        // 2. Light vector: Sun is located at Upper-Left (North-West)
        // Light direction vector pointing TOWARDS the sun:
        vec3 lightDir = normalize(vec3(-0.55, -0.65, 0.75));
        float NdotL = dot(normal, lightDir);
        float diff = max(0.0, NdotL);

        // 3. Directional self-shadowing:
        // March TOWARDS the sun (in lightDir.xy direction) to test for occluding ridges
        vec2 rayStep = normalize(lightDir.xy) * texel * 1.5;
        float shadow = 1.0;
        for (int i = 1; i <= 4; i++) {
          float sH = sampleHeight(v_uv + rayStep * float(i));
          if (sH > h + float(i) * 0.026) {
            shadow *= 0.65;
          }
        }

        // 4. Ambient occlusion from trough depth and surface curvature
        float laplacian = (hL + hR + hU + hD - 4.0 * h);
        float ao = clamp(1.0 + h * 0.42 - laplacian * 0.22, 0.35, 1.0);

        // 5. Sand Palette Shading with ambient garden wash
        float gardenGrad = (v_uv.x + v_uv.y) * 0.5;
        vec3 ambientBase = mix(u_grainLight, mix(u_baseColor, u_grainDark, clamp(gardenGrad * 0.7 + 0.15, 0.0, 1.0)), 0.75);

        vec3 col = ambientBase;
        if (h < 0.0) {
          float troughFactor = clamp(-h * 2.2, 0.0, 1.0);
          col = mix(ambientBase, u_grooveTrough, troughFactor);
        } else {
          float ridgeFactor = clamp(h * 2.0, 0.0, 1.0);
          col = mix(ambientBase, u_grainLight, ridgeFactor);
        }

        // Diffuse lighting and ambient occlusion
        vec3 lit = col * (0.32 + 0.68 * diff * shadow) * ao;

        // Direct warm sun glint on ridge crests
        if (diff > 0.35 && h > 0.01) {
          float hiWeight = pow(diff, 2.5) * clamp(h * 3.5, 0.0, 1.0) * shadow;
          lit = mix(lit, u_grooveHighlight.rgb, hiWeight * u_grooveHighlight.a);
        }

        // Groove shadow tint (cool penumbra on sheltered slopes)
        if (diff < 0.32 || shadow < 0.95) {
          float shWeight = (1.0 - diff) * (1.0 - shadow * 0.5) * clamp(-h * 1.5 + 0.35, 0.0, 1.0);
          lit = mix(lit, u_grooveShadow.rgb, shWeight * u_grooveShadow.a);
        }

        // 6. Tactile micro-grain sand noise & quartz crystalline facets
        vec2 grainCoord = v_uv * u_resolution;
        float grain1 = fract(sin(dot(grainCoord, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
        float grain2 = fract(sin(dot(grainCoord * 1.73, vec2(39.346, 11.135))) * 23421.631) - 0.5;
        float grain = (grain1 * 0.7 + grain2 * 0.3) * 0.042;

        // Sparkling quartz crystals on sunlit slopes
        if (diff > 0.55 && grain1 > 0.35) {
          grain += (grain1 - 0.35) * 0.12 * shadow;
        }

        lit += grain;
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
      uniform vec3 u_baseColor;
      uniform vec3 u_grainLight;
      uniform vec3 u_grainDark;
      uniform vec3 u_grooveTrough;
      uniform vec4 u_grooveShadow;
      uniform vec4 u_grooveHighlight;
      varying vec2 v_uv;

      float sampleHeight(vec2 uv) {
        // Luminance 8-bit decode: [0, 1] mapped to [-1, 1]
        return texture2D(u_heightmap, clamp(uv, 0.0, 1.0)).r * 2.0 - 1.0;
      }

      void main() {
        vec2 texel = 1.0 / u_resolution;
        float h = sampleHeight(v_uv);

        float hL = sampleHeight(v_uv - vec2(texel.x, 0.0));
        float hR = sampleHeight(v_uv + vec2(texel.x, 0.0));
        float hU = sampleHeight(v_uv - vec2(0.0, texel.y));
        float hD = sampleHeight(v_uv + vec2(0.0, texel.y));

        float dhX = (hR - hL) * 0.5 * u_resolution.x;
        float dhY = (hD - hU) * 0.5 * u_resolution.y;

        float bump = 5.2;
        vec3 normal = normalize(vec3(-dhX * bump, -dhY * bump, 1.0));

        vec3 lightDir = normalize(vec3(-0.55, -0.65, 0.75));
        float NdotL = dot(normal, lightDir);
        float diff = max(0.0, NdotL);

        // March towards sun
        vec2 rayStep = normalize(lightDir.xy) * texel * 1.5;
        float shadow = 1.0;
        for (int i = 1; i <= 3; i++) {
          float sH = sampleHeight(v_uv + rayStep * float(i));
          if (sH > h + float(i) * 0.03) {
            shadow *= 0.68;
          }
        }

        float laplacian = (hL + hR + hU + hD - 4.0 * h);
        float ao = clamp(1.0 + h * 0.42 - laplacian * 0.18, 0.38, 1.0);

        float gardenGrad = (v_uv.x + v_uv.y) * 0.5;
        vec3 ambientBase = mix(u_grainLight, mix(u_baseColor, u_grainDark, clamp(gardenGrad * 0.7 + 0.15, 0.0, 1.0)), 0.75);

        vec3 col = ambientBase;
        if (h < 0.0) {
          float troughFactor = clamp(-h * 2.2, 0.0, 1.0);
          col = mix(ambientBase, u_grooveTrough, troughFactor);
        } else {
          float ridgeFactor = clamp(h * 2.0, 0.0, 1.0);
          col = mix(ambientBase, u_grainLight, ridgeFactor);
        }

        vec3 lit = col * (0.32 + 0.68 * diff * shadow) * ao;

        if (diff > 0.35 && h > 0.02) {
          float hiWeight = pow(diff, 2.2) * clamp(h * 3.5, 0.0, 1.0) * shadow;
          lit = mix(lit, u_grooveHighlight.rgb, hiWeight * u_grooveHighlight.a);
        }

        if (diff < 0.3 || shadow < 0.95) {
          float shWeight = (1.0 - diff) * (1.0 - shadow * 0.5) * clamp(-h * 1.5 + 0.35, 0.0, 1.0);
          lit = mix(lit, u_grooveShadow.rgb, shWeight * u_grooveShadow.a);
        }

        vec2 grainCoord = v_uv * u_resolution;
        float grain = fract(sin(dot(grainCoord, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
        lit += grain * 0.038;

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
    palette: SandPalette
  ): void {
    if (this.gl && this.program) {
      this.renderWebGL(heightfield, width, height, palette);
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
    palette: SandPalette
  ): void {
    const gl = this.gl;
    const prog = this.program;
    if (!gl || !prog) return;

    const fw = heightfield.width;
    const fh = heightfield.height;

    if (this.canvas.width !== fw || this.canvas.height !== fh) {
      this.canvas.width = fw;
      this.canvas.height = fh;
      gl.viewport(0, 0, fw, fh);
      if (!this.isWebGL2) {
        this.byteBuffer = new Uint8Array(fw * fh);
      }
    }

    this.uploadHeightTexture(heightfield);

    gl.useProgram(prog);

    // Uniforms
    gl.uniform2f(gl.getUniformLocation(prog, 'u_resolution'), fw, fh);

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

    const bump = 5.2;
    // Light direction (-0.55, -0.65, 0.75) normalized
    const lx = -0.55;
    const ly = -0.65;
    const lz = 0.75;
    const lLen = Math.hypot(lx, ly, lz);
    const nlx = lx / lLen;
    const nly = ly / lLen;
    const nlz = lz / lLen;

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

        // Central difference gradient
        const dhX = (heights[idx + 1] - heights[idx - 1]) * 0.5 * fw;
        const dhY = (heights[idx + fw] - heights[idx - fw]) * 0.5 * fh;

        const nx = -dhX * bump;
        const ny = -dhY * bump;
        const nz = 1.0;
        const nLen = Math.hypot(nx, ny, nz) || 1;

        const dot = (nx * nlx + ny * nly + nz * nlz) / nLen;
        const diff = dot > 0 ? dot : 0;

        // Ambient occlusion
        const ao = Math.max(0.35, Math.min(1.0, 1.0 + hVal * 0.45));

        // Berm self-shadowing towards sun
        let shadowFactor = 1.0;
        const sStepX = Math.round(nlx * 2);
        const sStepY = Math.round(nly * 2);
        const sIdx = (y + sStepY) * fw + (x + sStepX);
        if (sIdx >= 0 && sIdx < heights.length && heights[sIdx] > hVal + 0.03) {
          shadowFactor = 0.65;
        }

        // Ambient garden wash
        const gardenGrad = (x / fw + y / fh) * 0.5;
        const ambFactor = Math.min(1.0, Math.max(0.0, gardenGrad * 0.7 + 0.15));
        let rBase = light.r * (1 - ambFactor) + (base.r * 0.5 + dark.r * 0.5) * ambFactor;
        let gBase = light.g * (1 - ambFactor) + (base.g * 0.5 + dark.g * 0.5) * ambFactor;
        let bBase = light.b * (1 - ambFactor) + (base.b * 0.5 + dark.b * 0.5) * ambFactor;
        rBase = rBase * 0.25 + base.r * 0.75;
        gBase = gBase * 0.25 + base.g * 0.75;
        bBase = bBase * 0.25 + base.b * 0.75;

        // Color interpolation
        let r = rBase;
        let g = gBase;
        let b = bBase;

        if (hVal < 0) {
          const t = Math.min(1.0, -hVal * 2.2);
          r = r + (trough.r - r) * t;
          g = g + (trough.g - g) * t;
          b = b + (trough.b - b) * t;
        } else {
          const t = Math.min(1.0, hVal * 2.0);
          r = r + (light.r - r) * t;
          g = g + (light.g - g) * t;
          b = b + (light.b - b) * t;
        }

        // Lighting intensity
        const lightFactor = (0.32 + 0.68 * diff * shadowFactor) * ao;
        r *= lightFactor;
        g *= lightFactor;
        b *= lightFactor;

        // Ridge highlight
        if (diff > 0.35 && hVal > 0.01) {
          const hiWeight = Math.min(1.0, Math.pow(diff, 2.2) * hVal * 3.5) * highlight.a * shadowFactor;
          r = r + (highlight.r - r) * hiWeight;
          g = g + (highlight.g - g) * hiWeight;
          b = b + (highlight.b - b) * hiWeight;
        }

        // Trough shadow tint
        if ((diff < 0.32 || shadowFactor < 0.95) && hVal < 0) {
          const shWeight = (1.0 - diff) * Math.min(1.0, -hVal * 1.5) * shadow.a;
          r = r + (shadow.r - r) * shWeight;
          g = g + (shadow.g - g) * shWeight;
          b = b + (shadow.b - b) * shWeight;
        }

        // Fast hash micrograin & quartz glint
        const grain = (((x * 131 + y * 313) % 17) - 8) * 1.5;
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
