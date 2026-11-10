module.exports=({webpackLoaderContext}={})=>({
 plugins:[require('./script/postcss-mona-colors.cjs')({
  scoped:new URLSearchParams(webpackLoaderContext?.resourceQuery?.slice(1)).has('scoped'),
 })],
});
