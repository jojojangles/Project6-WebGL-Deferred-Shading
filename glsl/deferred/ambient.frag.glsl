
#version 100
precision highp float;
precision highp int;

#define NUM_GBUFFERS 4

uniform sampler2D u_gbufs[NUM_GBUFFERS];
uniform sampler2D u_depth;

varying vec2 v_uv;

void main() {
    vec4 gb0 = texture2D(u_gbufs[0], v_uv).xyzw; //pos
    vec4 gb1 = texture2D(u_gbufs[1], v_uv).xyzw; //geornom
    vec4 gb2 = texture2D(u_gbufs[2], v_uv).xyzw; //color
    vec4 gb3 = texture2D(u_gbufs[3], v_uv).xyzw; //normalmap
    float depth = texture2D(u_depth, v_uv).x;
    // TO+DO: Extract needed properties from the g-buffers into local variables
    vec3 pos = gb0.xyz;
    vec3 geomnor = gb1.xyz;
    vec3 colmap = gb2.xyz;
    vec3 normap = gb3.xyz;
    
    if (depth == 1.0) {
        gl_FragColor = vec4(0, 0, 0, 0); // set alpha to 0
        return;
    }

    gl_FragColor = vec4(0.1, 0.1, 0.1, 1);  // TODO: replace this
}
