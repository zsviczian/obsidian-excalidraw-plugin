The project runs with `node 18`. 

After running `npm -i` you'll need to make two manual changes:

## postprocess
postprocess is used in rollup.config.js.
However, the version available on npmjs does not work, after installing packages you need this update: 
`npm install brettz9/rollup-plugin-postprocess#update --save-dev``

More info here: https://github.com/developit/rollup-plugin-postprocess/issues/10

## colormaster
1.2.1 misses 3 plugin references after installing the package you need to update
`node_modules/colormaster/package.json` adding the following to the `exports:` section:
```typescript
,
    "./plugins/luv": {
      "import": "./plugins/luv.mjs",
      "require": "./plugins/luv.js",
      "default": "./plugins/luv.mjs"
    },
    "./plugins/uvw": {
      "import": "./plugins/uvw.mjs",
      "require": "./plugins/uvw.js",
      "default": "./plugins/uvw.mjs"
    },
    "./plugins/ryb": {
      "import": "./plugins/ryb.mjs",
      "require": "./plugins/ryb.js",
      "default": "./plugins/ryb.mjs"
    }
```
