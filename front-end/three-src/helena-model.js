import * as T from 'three';

// Hand-modeled approximation from the supplied front, side and rear references.
// Units are relative, not measured. This is not a photogrammetric scan.
export function buildHelena() {
  const root = new T.Group(); root.name = 'Cesta_Helena_reconstrucao_aproximada';
  const mat = (color, roughness=.75, extra={}) => new T.MeshStandardMaterial({color,roughness,...extra});
  const grainCanvas=document.createElement('canvas');grainCanvas.width=128;grainCanvas.height=128;
  const grainContext=grainCanvas.getContext('2d'),grainImage=grainContext.createImageData(128,128);
  for(let i=0;i<grainImage.data.length;i+=4){const value=118+Math.random()*30;grainImage.data[i]=value;grainImage.data[i+1]=value;grainImage.data[i+2]=value;grainImage.data[i+3]=255;}
  grainContext.putImageData(grainImage,0,0);
  const fabricBump=new T.CanvasTexture(grainCanvas);fabricBump.wrapS=fabricBump.wrapT=T.RepeatWrapping;fabricBump.repeat.set(4,4);
  const fabric=(color,roughness=.94)=>mat(color,roughness,{bumpMap:fabricBump,bumpScale:.045});
  const pink=mat('#ce909f',.82), pale=mat('#f0c6cd',.88), cloth=fabric('#efb9cb'), white=fabric('#fff5e8'), skin=mat('#e8cbb1',.82), dark=mat('#353034',.6), hair=mat('#634534',.9);
  const sphere=new T.SphereGeometry(1,48,32);
  const box=new T.CylinderGeometry(.86,.86,1.03,96,2,true);
  function add(geometry,material,position,scale=[1,1,1],parent=root,name='') {
    const m=new T.Mesh(geometry,material); m.position.set(...position); m.scale.set(...scale); m.castShadow=true; m.receiveShadow=true; m.name=name; parent.add(m); return m;
  }
  const ell=(m,p,s,parent=root,name='')=>add(sphere,m,p,s,parent,name);
  const tube=(points,r,m,parent=root)=>add(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),40,r,7,false),m,[0,0,0],[1,1,1],parent);
  function ring(radius,tubeRadius,y,material,parent=root) {
    const mesh=add(new T.TorusGeometry(radius,tubeRadius,8,72),material,[0,y,0],[1,1,1],parent); mesh.rotation.x=Math.PI/2; return mesh;
  }
  add(box,pink,[0,.55,0],[1,1,1],root,'Caixa_rosa');
  add(new T.CylinderGeometry(.836,.836,.94,72,1,true),mat('#b7838b',.95,{side:T.BackSide}),[0,.60,0]);
  add(new T.CylinderGeometry(.86,.85,.13,72),pink,[0,.07,0]);
  add(new T.CylinderGeometry(.81,.81,.10,64),mat('#b2a08e'),[0,.97,0]);
  ring(.85,.021,1.06,pale); ring(.86,.012,.18,mat('#b57887'));
  // Satin ribbon runs around the hatbox, with pastel-colored sections.
  ['#ebcddd','#b9dadd','#efe0a6','#e8b2ca'].forEach((c,i)=>{
    add(new T.CylinderGeometry(.871,.871,.048,32,1,true,i*Math.PI/2,Math.PI/2+.01),mat(c,.36),[0,.88,0]);
  });
  function bow(parent,position,size,color) {
    const group=new T.Group(); group.position.set(...position); group.scale.setScalar(size); parent.add(group);
    const material=mat(color,.38);
    const left=ell(material,[-.19,0,0],[.22,.105,.055],group); left.rotation.z=-.42;
    const right=ell(material,[.19,0,0],[.22,.105,.055],group); right.rotation.z=.42;
    ell(material,[0,0,.025],[.075,.085,.067],group);
    return group;
  }
  const ribbonBow=bow(root,[.54,.90,.70],.55,'#f0bfd4'); ribbonBow.rotation.y=.5;
  tube([[.55,.90,.72],[.64,.64,.80],[.70,.28,.72],[.78,.03,.51]],.022,mat('#c5dfe1',.4));
  tube([[.51,.9,.72],[.46,.62,.83],[.55,.2,.85],[.70,.03,.70]],.022,mat('#f0dba6',.4));
  // Tissue paper: folded sheets behind the toys, with an irregular upper edge.
  const paper=mat('#efd0c5',.95,{side:T.DoubleSide});
  for(let i=0;i<10;i++) {
    const angle=-Math.PI*.2+i*Math.PI*1.4/9;
    const x=Math.cos(angle)*.61,z=-Math.sin(angle)*.59;
    const height=1.48+(i%3)*.17;
    const points=new Float32Array([x*.7,.88,z*.7,x-.22,height-.12,z,x,height+.14,z-.1,x+.26,height-.03,z,x*.7,.88,z*.7]);
    const geo=new T.BufferGeometry(); geo.setAttribute('position',new T.BufferAttribute(points,3));geo.setIndex([0,1,2,0,2,3]);geo.computeVertexNormals();
    add(geo,paper,[0,0,0]);
  }
  // Soft handmade doll based on the reference: white hood, pink bow, dress and visible legs.
  const doll=new T.Group(); doll.position.set(-.28,0,.02); doll.rotation.z=.13; root.add(doll); doll.name='Bonequinha_de_pelucia';doll.userData.separable=true;doll.userData.label='Bonequinha de pelúcia';
  const dress=fabric('#e8a6be',.92);
  ell(dress,[0,1.40,0],[.30,.37,.22],doll);
  const skirt=new T.LatheGeometry([new T.Vector2(.18,0),new T.Vector2(.20,.08),new T.Vector2(.25,.28),new T.Vector2(.33,.66),new T.Vector2(.29,.72),new T.Vector2(0,.72)],64);
  add(skirt,dress,[0,.83,0],[1,1,1],doll,'Vestido_rosa');
  ell(white,[0,2.02,-.02],[.43,.42,.30],doll);
  ell(skin,[0,1.98,.204],[.346,.295,.135],doll);
  // White cloth hood falls down around the face instead of forming rabbit ears.
  for(const side of [-1,1]) {
    const hood=ell(white,[side*.34,1.78,.015],[.115,.39,.115],doll);hood.rotation.z=side*.10;
    const arm=ell(dress,[side*.29,1.28,.045],[.09,.25,.105],doll);arm.rotation.z=-side*.16;
    ell(skin,[side*.31,1.055,.105],[.061,.072,.067],doll,'Mao_da_boneca');
    const leg=ell(dress,[side*.15,.91,.20],[.105,.27,.11],doll,`Perna_${side<0?'esquerda':'direita'}`);leg.rotation.z=-side*.07;
  }
  ell(hair,[-.025,2.22,.217],[.30,.095,.08],doll).rotation.z=.07;
  ell(hair,[.19,2.24,.20],[.15,.075,.07],doll).rotation.z=.45;
  for(const side of [-1,1]) {
    // Closed embroidered eyelids and individual eyelashes.
    const cx=side*.155;
    tube([[cx-.10,2.015,.322],[cx,1.976,.337],[cx+.095,2.015,.322]],.009,dark,doll);
    for(let n=0;n<4;n++) {
      const x=cx-.07+n*.045;
      tube([[x,1.983+Math.abs(x-cx)*.18,.335],[x+side*.015,1.945+Math.abs(x-cx)*.18,.337]],.006,dark,doll);
    }
    ell(mat('#e6a6a7'),[side*.235,1.896,.30],[.060,.026,.017],doll);
  }
  ell(mat('#c48b8c'),[0,1.938,.339],[.025,.012,.011],doll);
  tube([[-.023,1.887,.331],[0,1.875,.334],[.026,1.888,.331]],.004,mat('#c58f8e'),doll);
  const scarf=mat('#c37599',.98);
  ell(scarf,[0,1.655,.04],[.292,.12,.236],doll);
  for(let i=0;i<8;i++) ring(.247,.0035,1.60+i*.014,mat(i%2?'#d58eaa':'#b8698b',.9),doll);
  const hairBow=bow(doll,[-.33,2.28,.19],.52,'#d780a0'); hairBow.rotation.z=.5;
  // Pair of high-top baby sneakers with rubber toes, eyelets and laces.
  const shoePink=mat('#bc859e',.88), sole=mat('#f1eee5'), trim=mat('#4e454a');
  [-.21,.21].forEach((x,index)=>{
    // The shoes sit in the front half of the box, below the rim, rather than outside it.
    const shoe=new T.Group(); shoe.position.set(-.28+x*.72,1.02,.36); shoe.rotation.x=.04; shoe.rotation.z=index ? -.12 : .12; root.add(shoe); shoe.name='Sapatinho_'+(index+1);shoe.userData.separable=true;shoe.userData.label=`Sapatinho ${index+1}`;
    ell(sole,[0,0,0],[.20,.055,.32],shoe);
    ell(shoePink,[0,.105,-.025],[.188,.148,.282],shoe);
    ell(sole,[0,.092,.165],[.184,.082,.154],shoe);
    tube([[-.18,.076,.10],[-.16,.09,.27],[0,.09,.31],[.16,.09,.27],[.18,.076,.10]],.006,trim,shoe);
    ell(shoePink,[0,.21,-.145],[.172,.14,.13],shoe);
    for(let n=0;n<4;n++) {
      const z=.09-n*.065,y=.23+n*.013;
      for(const side of [-1,1]) {
        const eye=add(new T.TorusGeometry(.018,.005,6,12),mat('#c8c6c0',.3,{metalness:.6}),[side*.095,y,z],[1,1,1],shoe);eye.rotation.x=Math.PI/2;
      }
      tube([[-.095,y+.004,z],[0,y+.015,z-.015],[.095,y+.004,z]],.010,white,shoe);
    }
  });
  // Dried bouquet: eucalyptus, stems and small paper-like hydrangeas.
  const bouquet=new T.Group();bouquet.name='Buque_de_flores';bouquet.userData.separable=true;bouquet.userData.label='Buquê de flores';root.add(bouquet);
  const stems=mat('#7d7350',.96), leaves=fabric('#76816c'), petals=[fabric('#d2bc87'),fabric('#c8b88d'),fabric('#d0a5a0'),fabric('#d5b8a0')];
  for(let i=0;i<17;i++) {
    const a=i*2.399,x=.40+Math.cos(a)*.19,y=1.42+(i%6)*.09,z=.03+Math.sin(a)*.23;
    tube([[.45,1.0,.06],[x,y,z]],.007,stems,bouquet);
    if(i<6) {
      for(let n=0;n<3;n++) {const leaf=ell(leaves,[x+(n%2?-.055:.055),y-n*.085,z],[.07,.03,.09],bouquet);leaf.rotation.z=a;}
    } else {
      for(let n=0;n<5;n++) {const p=n/5*Math.PI*2;const petal=ell(petals[i%4],[x+Math.cos(p)*.038,y+Math.sin(p)*.04,z],[.042,.039,.013],bouquet);petal.rotation.z=p;}
    }
  }
  for(let i=0;i<5;i++) {
    const x=.48+i*.036,h=1.80+i*.048;
    tube([[.44,1.04,-.09],[x,h,-.12]],.005,stems,bouquet);
    for(let n=0;n<8;n++) ell(petals[0],[x+(n%2?.018:-.018),h-n*.035,-.12],[.017,.039,.014],bouquet);
  }
  function balloon(position,scale,color,name) {
    const group=new T.Group();group.name=name;group.userData.separable=true;group.userData.label=name==='Balao_rosa'?'Balão rosa':'Balão azul';root.add(group);
    const material=new T.MeshPhysicalMaterial({color,roughness:.19,metalness:.025,clearcoat:.82,clearcoatRoughness:.12});
    const mesh=ell(material,position,scale,group,name);
    const y=position[1]-scale[1];
    add(new T.ConeGeometry(.036,.08,14),material,[position[0],y-.02,position[2]],[1,1,1],group).rotation.z=Math.PI;
    tube([[position[0],y-.055,position[2]],[position[0]+.04,(y+1.02)/2,position[2]],[.20,1.03,-.15]],.007,white,group);
    return mesh;
  }
  balloon([-.05,3.13,-.28],[.59,.69,.55],'#e3adc5','Balao_rosa');
  balloon([.64,2.56,-.05],[.43,.52,.41],'#7acdd0','Balao_menta');
  // Personalization on the front of the box, represented as a transparent label.
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#fff2eb';ctx.font='italic 150px Georgia';ctx.textAlign='center';ctx.fillText('Helena',512,185);
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
  add(new T.PlaneGeometry(1.02,.30),new T.MeshStandardMaterial({map:texture,transparent:true,roughness:.9,depthWrite:false}),[0,.56,.871]);
  // The two readable cards belong to the demo, not to the photographed object.
  const cardMat=mat('#fff9ee',.9);
  const personal=add(new T.BoxGeometry(.42,.29,.013),cardMat,[-1.13,.30,.28],[1,1,1],root,'Cartinha_do_presente');personal.rotation.set(-.12,.32,-.10);personal.userData.card='message';
  const brand=add(new T.BoxGeometry(.42,.29,.013),cardMat,[1.12,.30,.28],[1,1,1],root,'Cartao_Ella_Sorriu');brand.rotation.set(-.12,-.32,.10);brand.userData.card='brand';
  root.userData={type:'hand-modeled approximation',source:'User photos and video, 2026-10-09',measured:false};
  return root;
}
