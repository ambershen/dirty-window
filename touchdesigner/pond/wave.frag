uniform vec4 uTouch;
out vec4 fragColor;
void main(){
 vec2 uv=vUV.st, px=uTD2DInfos[0].res.xy;
 vec2 s=texture(sTD2DInputs[0],uv).rg;
 float lap=texture(sTD2DInputs[0],uv+vec2(px.x,0)).r+texture(sTD2DInputs[0],uv-vec2(px.x,0)).r+texture(sTD2DInputs[0],uv+vec2(0,px.y)).r+texture(sTD2DInputs[0],uv-vec2(0,px.y)).r-4.0*s.r;
 float r=length((uv-uTouch.xy)*vec2(16./9.,1.))/max(uTouch.w,0.001);
 // A zero-volume Mexican-hat impulse displaces water without steadily filling the pool.
 float impulse=(1.0-r*r)*exp(-r*r)*uTouch.z;
 float vel=(s.g+0.24*lap+impulse)*0.991;
 float edge=min(min(uv.x,1.-uv.x),min(uv.y,1.-uv.y));
 vel*=mix(0.85,1.0,smoothstep(0.,0.045,edge));
 float h=(s.r+vel)*0.9995;
 fragColor=TDOutputSwizzle(vec4(h,vel,0.,1.));
}
