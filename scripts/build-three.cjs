require('esbuild').buildSync({entryPoints:['front-end/three-src/demo.js'],bundle:true,minify:true,outfile:'front-end/present-3d.js',format:'iife',target:['chrome100','edge100'],legalComments:'eof'});
