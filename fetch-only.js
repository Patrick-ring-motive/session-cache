(()=>{

let init = (async () => {
  let importCache =  caches.open("http-session-cache");
  async function importFromCache(url){
    if(importCache instanceof Promise)importCache = await importCache;
    let res = await importCache.match(url);
    if(res instanceof Response){
      res.clone();
    }else{
      res = await fetch(url);
      putCache(url,res.clone());
    }
    return eval?.call(globalThis, await res.text());
  }
  async function putCache(url,res){
    const cache = await importCache;
    if(res instanceof Response && res.status === 200)cache.put(url,res.clone());
  }
  async function importScript(url) {
      try{
        return await import(url);
      }catch{
        return eval?.call(globalThis, await (await fetch(url)).text()); 
      }
  }
  await Promise.all([
    importFromCache(
      `https://cdn.jsdelivr.net/npm/pretty-pako/pretty-pako.js`,
    ),
    importFromCache(
      `https://cdn.jsdelivr.net/npm/superjson-bundle@1.0.7/dist/superjson.js`,
    ),
  ]);

  (()=>{


    const instanceOf = (x, y) => {
      try {
        return x instanceof y;
      } catch {
        return false;
      }
    };

    const typeOf = x => {
      if (x === undefined) return 'undefined';
      if (x === null) return 'null';
      return String(x?.constructor?.name ?? x?.__proto__?.name ?? typeof x);
    };
    const constructOf = (x, y) => instanceOf(x, y) || (y?.name && typeOf(x) === String(y?.name));
    const isString = x => constructOf(x, String) || typeof x === 'string';
    const isHeaders = x => constructOf(x, Headers);
    const isURLSearchParams = x => constructOf(x, URLSearchParams);
    const isURL = x => constructOf(x, URL) || (isString(x) && /^https?\:\/\//i.test(x));
    const isFunction = x => constructOf(x, Function);
    const isFormData = x => constructOf(x, FormData);
    const isArrayBuffer = x => constructOf(x, ArrayBuffer);

    const jcopy = x => JSON.parse(JSON.stringify(x));


    superjson.registerCustom({
      isApplicable: isHeaders,
      serialize: headers => [...headers.entries()],
      deserialize: headers => new Headers(headers)
    }, 'Headers');

    superjson.registerCustom({
      isApplicable: isURLSearchParams,
      serialize: params => [...params.entries()],
      deserialize: params => new URLSearchParams(params)
    }, 'URLSearchParams');

    superjson.registerCustom({
      isApplicable: isURL,
      serialize: url => {
        const obj = {};
        if (isString(url)) url = new URL(url);
        for (const x in url) {
          if (!isFunction(url[x])) {
            obj[x] = url[x];
          }
        }
        obj.searchParams = superjson.serialize(url.searchParams);
        return obj;
      },
      deserialize: obj => {
        const url = new URL(obj.href);
        try {
          url.searchParams = superjson.deserialize(obj.searchParams);
        } catch { }
        return url;
      }
    }, 'URL');

    superjson.registerCustom({
      isApplicable: isFormData,
      serialize: fd => [...fd.entries()],
      deserialize: obj => {
        const fd = new FormData();
        for (const [key, value] of obj) {
          fd.append(key, value);
        }
        return fd;
      }
    }, 'FormData');

    superjson.registerCustom({
      isApplicable: isArrayBuffer,
      serialize: ab => JSON.stringify([...new Uint8Array(ab)]),
      deserialize: ab => new Uint8Array(JSON.parse(ab)).buffer
    }, 'ArrayBuffer');


    globalThis.superjson = superjson;


    const responseToBase64 = async (response) => {
      const arrayBuffer = await response.arrayBuffer();
      const uint8Array = pako.deflate(new Uint8Array(arrayBuffer));
      const body = Array(uint8Array.length);
      for (let i = 0; i < uint8Array.length; i++){
        body[i] = String.fromCharCode(uint8Array[i]);
      }
      const res = {
        headers: response.headers,
        status: response.status,
        url:response.url,
        body: btoa(body.join(''))
      };
      return superjson.stringify(res);
    };

    const base64ToResponse = (serializedResponse) => {
      const res = superjson.parse(serializedResponse);
      const binaryString = atob(res.body);
      const uint8Array = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        uint8Array[i] = binaryString.charCodeAt(i);
      }
      return Object.defineProperty(new Response(pako.inflate(uint8Array), {
        status: res.status,
        headers: res.headers,
      }),'url',{value:String(res.url),enumerable:true,configurable:true,writable:true,writeable:true});
    };


    globalThis.sessionCache = {
      async set(key, value) {
        try{
          return sessionStorage.setItem(key, await responseToBase64(value));
        }catch(e){
          console.warn(e,...arguments);
        }
      },
      get(key) {
        try{
          const value = sessionStorage.getItem(key);
          if (value) return base64ToResponse(value);
        }catch(e){
          console.warn(e,...arguments);
        }
      },
      delete(key) {
        return sessionStorage.removeItem(key);
      }
    };
})();


    (()=>{
      const $fetch = Symbol('*fetch');
      const _fetch = globalThis.fetch;
      globalThis[$fetch] = _fetch;
      globalThis.fetch = Object.setPrototypeOf(async function fetch(url,options){
        try{
          if(init instanceof Promise){
            init = await init;
          }
          const req = new Request(...arguments);
          if (req.method === 'GET') {
            const res = self?.sessionCache?.get?.(req.url);
            if (res) {
              return res;
            } else {
              const response = await _fetch.call(this,req);
              if (response.status === 200) {
                sessionCache.set(req.url, response.clone());
              }
              return response;
            }
          } else {
            return _fetch.call(this,req);
          }
        }catch(e){
          response = new Response(e, {
            status: 469,
            statusText: e.message
          });
          console.warn(this,e,...arguments);
        }
      },_fetch);
    })();

  })();

  
})();