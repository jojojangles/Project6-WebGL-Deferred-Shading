#version 100
precision highp float;
precision highp int;

#define NUM_GBUFFERS 4

uniform vec3 u_lightCol;
uniform vec3 u_lightPos;
uniform float u_lightRad;
uniform sampler2D u_gbufs[NUM_GBUFFERS];
uniform sampler2D u_depth;
uniform vec3 u_campos;

varying vec2 v_uv;

vec3 applyNormalMap(vec3 geomnor, vec3 normap) {
    normap = normap * 2.0 - 1.0;
    vec3 up = normalize(vec3(0.001, 1, 0.001));
    vec3 surftan = normalize(cross(geomnor, up));
    vec3 surfbinor = cross(geomnor, surftan);
    return normap.y * surftan + normap.x * surfbinor + normap.z * geomnor;
}

void main() {
    vec4 gb0 = texture2D(u_gbufs[0], v_uv);
    vec4 gb1 = texture2D(u_gbufs[1], v_uv);
    vec4 gb2 = texture2D(u_gbufs[2], v_uv);
    vec4 gb3 = texture2D(u_gbufs[3], v_uv);
    float depth = texture2D(u_depth, v_uv).x;
    // TODO: Extract needed properties from the g-buffers into local variables
    vec3 pos = gb0.xyz;
    vec3 geomnor = gb1.xyz;
    vec3 colmap = gb2.xyz;
    vec3 normap = gb3.xyz;
    vec3 nor = applyNormalMap(geomnor,normap);

    vec3 specularColor = vec3(1,1,1);
    float shiny = 16.0;

    // If nothing was rendered to this pixel, set alpha to 0 so that the
    // postprocessing step can render the sky color.
    if (depth == 1.0) {
        gl_FragColor = vec4(0, 0, 0, 0);
        return;
    }

    vec3 lightDir = u_lightPos - pos;
    float distance = length(lightDir);
    lightDir = lightDir / distance;

    float lam = max(dot(lightDir,nor),0.0);
    float spe = 0.0;
    float d = max(distance - u_lightRad, 0.0);
    float att = d/u_lightRad + 1.0;
    att = 1.0 / (att * att);

    if(lam > 0.0) {
        vec3 view = normalize(pos - u_campos);
        vec3 halfS = normalize(lightDir + view);
        float sAngle = max(dot(halfS,nor),0.0);
        spe = pow(sAngle,shiny);
    }

    if(distance > u_lightRad) {
      gl_FragColor = vec4(0,0,0,0);
      return;
    }
    else {
      gl_FragColor = vec4((lam*colmap + spe*specularColor)*att, 1) / distance;  // TODO: perform lighting calculations
    }
}
