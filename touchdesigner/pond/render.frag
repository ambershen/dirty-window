out vec4 fragColor;
void main(){
 vec2 uv=vUV.st, px=uTD2DInfos[0].res.xy;
 float l=texture(sTD2DInputs[0],uv-vec2(px.x,0)).r;
 float r=texture(sTD2DInputs[0],uv+vec2(px.x,0)).r;
 float b=texture(sTD2DInputs[0],uv-vec2(0,px.y)).r;
 float t=texture(sTD2DInputs[0],uv+vec2(0,px.y)).r;
 float h=texture(sTD2DInputs[0],uv).r;
 vec2 slope=vec2(r-l,t-b);
 float outputAspect=uTDOutputInfo.res.z/uTDOutputInfo.res.w;
 float sourceAspect=uTD2DInfos[1].res.z/uTD2DInfos[1].res.w;
 // Preserve camera proportions even when another app changes its capture format.
 vec2 cover=vec2(min(1.,outputAspect/sourceAspect),min(1.,sourceAspect/outputAspect));
 vec2 displacement=clamp(slope*.30,vec2(-.028),vec2(.028));
 displacement.x/=outputAspect;
 vec2 cameraUV=(uv+displacement-.5)*cover+.5;
 vec3 col=texture(sTD2DInputs[1],clamp(cameraUV,.001,.999)).rgb;
 // Wave-local lighting gives ripples definition without warping the idle portrait.
 float curvature=l+r+b+t-4.*h;
 float lighting=clamp(dot(slope,vec2(-.6,.8))*4.2-curvature*7.,-.30,.30);
 col*=1.+lighting;
 vec3 normal=normalize(vec3(-slope*11.,1.));
 float specular=pow(max(dot(normal,normalize(vec3(-.28,.35,1.))),0.),36.);
 float activity=smoothstep(.0008,.018,length(slope));
 col+=vec3(.68,.88,1.)*specular*.30*activity;
 fragColor=TDOutputSwizzle(vec4(col,1.));
}
