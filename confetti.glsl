// Vertex Shader
const vertexShader = `
    attribute vec2 position;
    attribute vec3 color;
    attribute float size;
    attribute float rotation;
    
    uniform mat4 projection;
    uniform float time;
    
    varying vec3 vColor;
    
    void main() {
        vColor = color;
        float angle = rotation + time * 2.0;
        mat2 rot = mat2(
            cos(angle), -sin(angle),
            sin(angle), cos(angle)
        );
        vec2 rotatedPos = rot * position;
        gl_Position = projection * vec4(rotatedPos, 0.0, 1.0);
        gl_PointSize = size;
    }
`;

// Fragment Shader
const fragmentShader = `
    precision mediump float;
    varying vec3 vColor;
    
    void main() {
        vec2 coord = gl_PointCoord - vec2(0.5);
        if (length(coord) > 0.5) discard;
        gl_FragColor = vec4(vColor, 1.0);
    }
`; 