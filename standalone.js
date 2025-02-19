(async () => {
  async function importScript(url) {
    try {
      return await import(url);
    } catch {
      return eval?.call(globalThis, await (await fetch(url)).text());
    }
  }

  await Promise.all([
    importScript(
      `https://cdn.jsdelivr.net/npm/pako/dist/pako.min.js?${new Date().getTime()}`,
    ),
    importScript(
      `https://cdn.jsdelivr.net/npm/superjson-bundle@1.0.7/dist/superjson.js?${new Date().getTime()}`,
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
      return new Response(pako.inflate(uint8Array), {
        status: res.status,
        headers: res.headers
      });
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


    (()=>{
      const $fetch = Symbol('*fetch');
      const _fetch = globalThis.fetch;
      globalThis[$fetch] = _fetch;
      globalThis.fetch = Object.setPrototypeOf(async function fetch(url,options){
        try{
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

  (() => {
    /**
     * Safely invokes a function if it exists, returning undefined on ReferenceError.
     * @function
     * @param {Function} varFn - Function to invoke.
     * @returns {*} The return value of varFn if it exists and doesn't throw ReferenceError; otherwise undefined.
     */
    const q = (varFn) => {
      try {
        return varFn?.();
      } catch (e) {
        if (e.name != "ReferenceError") {
          throw e;
        }
      }
    };

    /**
     * The global object reference, derived from the best available environment.
     * @type {Object}
     */
    const globalObject =
      q(() => globalThis) ??
      q(() => self) ??
      q(() => global) ??
      q(() => window) ??
      this ??
      {};

    // Bind the global object to multiple references in the environment.
    for (let x of ["globalThis", "self", "global"]) {
      globalObject[x] = globalObject;
    }

    /**
     * Expose the q function on self.
     * @type {Function}
     */
    self.q = q;

    /**
     * Creates a new instance from the first argument (constructor) in args, with subsequent args as constructor parameters.
     * @function
     * @param {...*} args - The first element should be a constructor. The rest are passed as arguments to it.
     * @returns {*} A new instance or undefined if no valid constructor is provided.
     */
    self.newQ = (...args) => {
      const fn = args?.shift?.();
      return fn && new fn(...args);
    };

    /**
     * Defines a property on an object with the specified descriptors.
     * @function
     * @param {Object} obj - Target object.
     * @param {string} prop - Property name.
     * @param {*} def - Property value.
     * @param {boolean} enm - Whether the property is enumerable.
     * @param {boolean} mut - Whether the property is writable/configurable.
     * @returns {Object} The modified object.
     */
    const objDoProp = function (obj, prop, def, enm, mut) {
      return Object.defineProperty(obj, prop, {
        value: def,
        writable: mut,
        enumerable: enm,
        configurable: mut,
      });
    };

    /**
     * Defines a non-enumerable, configurable property on an object.
     * @function
     * @param {Object} obj - Target object.
     * @param {string} prop - Property name.
     * @param {*} def - Property value.
     * @returns {Object} The modified object.
     */
    const objDefProp = (obj, prop, def) =>
      objDoProp(obj, prop, def, false, true);

    /**
     * Defines an enumerable, configurable property on an object.
     * @function
     * @param {Object} obj - Target object.
     * @param {string} prop - Property name.
     * @param {*} def - Property value.
     * @returns {Object} The modified object.
     */
    const objDefEnum = (obj, prop, def) =>
      objDoProp(obj, prop, def, true, true);

    /**
     * Defines a non-enumerable, non-configurable property on an object (frozen).
     * @function
     * @param {Object} obj - Target object.
     * @param {string} prop - Property name.
     * @param {*} def - Property value.
     * @returns {Object} The modified object.
     */
    const objFrzProp = (obj, prop, def) =>
      objDoProp(obj, prop, def, false, false);

    /**
     * Defines an enumerable, non-configurable property on an object (frozen).
     * @function
     * @param {Object} obj - Target object.
     * @param {string} prop - Property name.
     * @param {*} def - Property value.
     * @returns {Object} The modified object.
     */
    const objFrzEnum = (obj, prop, def) =>
      objDoProp(obj, prop, def, true, false);

    /**
     * Defines an enumerable accessor property on an object with get/set functions.
     * @function
     * @param {Object} obj - Target object.
     * @param {string} prop - Property name.
     * @param {Function} getFn - Getter function.
     * @param {Function} setFn - Setter function.
     * @returns {Object} The modified object.
     */
    const objDefEnumAcc = (obj, prop, getFn, setFn) => {
      let _prop;
      return Object.defineProperty(obj, prop, {
        get() {
          return getFn(_prop);
        },
        set(value) {
          _prop = setFn(value);
        },
        enumerable: true,
        configurable: true,
        writeable: true,
      });
    };

    /**
     * Defines a non-enumerable accessor property on an object with get/set functions.
     * @function
     * @param {Object} obj - Target object.
     * @param {string} prop - Property name.
     * @param {Function} getFn - Getter function.
     * @param {Function} setFn - Setter function.
     * @returns {Object} The modified object.
     */
    const objDefPropAcc = (obj, prop, getFn, setFn) => {
      let _prop;
      return Object.defineProperty(obj, prop, {
        get() {
          return getFn?.(_prop);
        },
        set(value) {
          _prop = setFn?.(value);
        },
        enumerable: false,
        configurable: true,
        writeable: true,
      });
    };

    /**
     * Retrieves the names of all own properties on an object.
     * @function
     * @param {Object} x - The target object.
     * @returns {string[]} The names of the object's own properties.
     */
    const objectNames = (x) => Object.getOwnPropertyNames(x);

    /**
     * Retrieves the symbols of all own properties on an object.
     * @function
     * @param {...Object} arguments - Objects for which to get the property symbols.
     * @returns {Symbol[]} The symbols of the object's own properties.
     */
    const objectSymbols = function () {
      return Object.getOwnPropertySymbols(...arguments);
    };

    /**
     * Defines multiple non-enumerable, configurable properties on an object.
     * @function
     * @param {Object} obj - Target object.
     * @param {Object} [props={}] - An object whose keys are property names and values are the properties to set.
     * @returns {Object} The modified object.
     */
    const objDefProps = function objDefProps(obj, props = {}) {
      for (let prop in props) {
        objDefProp(obj, prop, props[prop]);
      }
      return obj;
    };

    /**
     * Retrieves the prototype of an object.
     * @function
     * @param {...Object} arguments - Objects from which to get the prototype.
     * @returns {Object} The prototype of the object.
     */
    const objGetProto = function () {
      return Object.getPrototypeOf(...arguments);
    };

    /**
     * Sets the prototype of an object.
     * @function
     * @param {...Object} arguments - The target object and the new prototype.
     * @returns {Object} The target object with the updated prototype.
     */
    const objSetProto = function () {
      return Object.setPrototypeOf(...arguments);
    };

    /**
     * Assigns the prototype of src to target. If direct assignment fails, tries assigning properties individually.
     * @function
     * @param {Object} target - The object whose prototype will be set.
     * @param {Object|Function} src - The source whose prototype will be used.
     */
    function assignProto(target, src) {
      const proto = src?.prototype ?? Object(src);
      try {
        objDefProp(target, "prototype", proto);
      } catch {
        try {
          target.prototype = proto;
        } catch {}
        if (target.prototype != proto) {
          assignAll(target.prototype, proto);
        }
      }
    }

    /**
     * An XMLSerializer instance created via newQ.
     * @type {XMLSerializer}
     */
    const serializer = newQ(globalThis.XMLSerializer);

    /**
     * Serializes an XML Node to a string using the global serializer.
     * @function
     * @param {Node} node - The XML Node to serialize.
     * @returns {string} The serialized XML string.
     */
    const serializeXML = (node) => serializer?.serializeToString?.(node);

    /**
     * Converts an ArrayBuffer or array-like object to a Uint8Array.
     * @function
     * @param {ArrayBuffer|ArrayLike<number>} buff - The buffer or array-like to convert.
     * @returns {Uint8Array} The Uint8Array.
     */
    const bytes = (buff) => new Uint8Array(buff);

    /**
     * A TextEncoder instance created via newQ.
     * @type {TextEncoder}
     */
    const encoder = newQ(globalThis.TextEncoder);

    /**
     * Encodes a string into UTF-8 bytes using the global encoder.
     * @function
     * @param {string} s - The string to encode.
     * @returns {Uint8Array} The UTF-8 encoded data.
     */
    const encode = (s) =>
      encoder?.encode?.(s) ?? bytes([...s].map((x) => x.charCodeAt()));

    /**
     * Encodes a string and returns the raw ArrayBuffer of the UTF-8 encoded data.
     * @function
     * @param {string} s - The string to encode.
     * @returns {ArrayBuffer} The encoded string as an ArrayBuffer.
     */
    const buffer = (s) => encode(s).buffer;

    /**
     * A TextDecoder instance created via newQ.
     * @type {TextDecoder}
     */
    const decoder = newQ(globalThis.TextDecoder);

    /**
     * Decodes a Uint8Array or ArrayBuffer-like object to a string using UTF-8.
     * @function
     * @param {Uint8Array|ArrayBuffer} byte - The data to decode.
     * @returns {string} The decoded string.
     */
    const decode = (byte) =>
      decoder?.decode?.(byte) ?? String.fromCharCode(...byte);

    /**
     * Attempts to decode data into text via UTF-8. Falls back to fromCharCode on error.
     * @function
     * @param {Uint8Array|ArrayBuffer} byte - The data to decode.
     * @returns {string} The decoded string (best effort).
     */
    const zdecode = (byte) => {
      try {
        return decoder.decode(byte);
      } catch {
        try {
          return String.fromCharCode(...byte);
        } catch {
          return String(bytes);
        }
      }
    };

    /**
     * Converts an ArrayBuffer to a string by decoding it as UTF-8.
     * @function
     * @param {ArrayBuffer} buff - The buffer to decode.
     * @returns {string} The decoded string.
     */
    const text = (buff) => decode(bytes(buff));

    /**
     * A DOMParser used for converting text into HTML documents.
     * @type {DOMParser}
     */
    const parser = newQ(self.DOMParser);

    /**
     * Parses a string as HTML and returns the resulting Document.
     * @function
     * @param {string} x - The string to parse as HTML.
     * @returns {Document} The parsed HTML document.
     */
    const textDoc = (x) => parser.parseFromString(x, "text/html");

    /**
     * Attempts to serialize a Document or Element to a string. Falls back to outerHTML or string representation on error.
     * @function
     * @param {Document|Element} doc - The DOM node to serialize.
     * @returns {string} The serialized string representation.
     */
    function docText(doc) {
      try {
        return new XMLSerializer().serializeToString(doc);
      } catch (e) {
        console.warn(e, ...arguments);
        return (
          doc?.outerHTML?.toString?.() ??
          doc?.firstElementChild?.outerHTML?.toString?.() ??
          String(doc)
        );
      }
    }
    function stealth(shadow, original) {
      shadow = Object(shadow);
      original = Object(original);
      objDefProp(shadow, "toString", function toString() {
        return original.toString();
      });
      Object.setPrototypeOf(shadow, original);
      return shadow;
    }

    /**
     * Replaces a method on an object with a custom function, preserving the original under a Symbol.
     * @function
     * @param {Object} root - The object containing the method to intercede.
     * @param {string} name - The name of the property (method) to replace.
     * @param {Symbol} key - Symbol used to store the original method.
     * @param {Function} fn - The custom function that replaces the original.
     */
    function intercede(root, name, key, fn) {
      root = Object(root);
      name = String(name);
      fn = Object(fn);
      objDefProp(root, key, root?.[name]);
      objDefEnum(root, name, fn);
      stealth(root?.[name], root?.[key]);
    }

    function xhrHeaders(xhr) {
      const headers = new Headers();
      String(xhr?.getAllResponseHeaders?.())
        .split("\n")
        .map((x) => {
          const value = x.split(":");
          const key = String(value.shift()).trim();
          return [key, value.join(":").trim()];
        })
        .filter((x) => x[0])
        .forEach((x) => {
          try {
            headers.append(x[0], x[1]);
          } catch {}
        });
      return headers;
    }

    function uint8ToBase64(uint8Array) {
      const body = Array(uint8Array.length);
      for (let i = 0; i < uint8Array.length; i++) {
        body[i] = String.fromCharCode(uint8Array[i]);
      }
      return btoa(body.join(""));
    }

    function base64ToUint8(base64) {
      const binaryString = atob(base64);
      const uint8Array = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        uint8Array[i] = binaryString.charCodeAt(i);
      }
      return uint8Array;
    }

    const xhrToBase64 = async (xhr) => {
      let arrayBuffer;
      try {
        if (xhr.responseType == "document") {
          arrayBuffer = buffer(docText(xhr.response));
        }
        if (typeof xhr.response == "arrayBuffer") {
          arrayBuffer = xhr.response;
        }
        if (typeof xhr.response == "json") {
          arrayBuffer = buffer(JSON.stringify(xhr.response));
        }
        if (typeof xhr.response == "blob") {
          arrayBuffer = await xhr.response.arrayBuffer();
        }
        if (!arrayBuffer)
          arrayBuffer = buffer(xhr.responseText || xhr.statusText);
      } catch (e) {
        console.warn(e, this, ...arguments);
        arrayBuffer = buffer(e.message);
      }
      const uint8Array = pako.deflate(new Uint8Array(arrayBuffer));
      const res = {
        headers: xhrHeaders(xhr),
        status: xhr.status,
        body: uint8ToBase64(uint8Array),
      };
      return superjson.stringify(res);
    };

    const base64ToURI = (serializedResponse) => {
      const res = superjson.parse(serializedResponse);
      return `data:${String(res.headers.get("content-type") || "")
        .split(";")
        .shift()};base64,${uint8ToBase64(pako.inflate(base64ToUint8(res.body)))}`;
    };

    globalThis.xhrSessionCache = {
      async set(key, value) {
        try{
          return sessionStorage.setItem(key, await xhrToBase64(value));
        }catch(e){
          console.warn(e,...arguemnts);
        }
      },
      get(key) {
        try{
          const value = sessionStorage.getItem(key);
          if (value) return base64ToURI(value);
        }catch(e){
          console.warn(e,...arguemnts);
        }
      },
      delete(key) {
        return sessionStorage.removeItem(key);
      },
    };
    (() => {
      /**
       * Intercedes the XMLHttpRequest `open` method to capture request metadata.
       * @symbol $open - Stores the original open method.
       */
      const $open = Symbol("*open");
      const _open = (self?.XMLHttpRequest?.prototype ?? {}).open;
      intercede(
        globalThis.XMLHttpRequest?.prototype ?? {},
        "open",
        $open,
        function open(method, url, asynch, user, password) {
          try {
            objDefProp(this, "&request", {
              method: String(method || "GET").toUpperCase(),
              url: String(url),
              async: asynch,
              user: user,
              password: password,
              headers: new Map(),
            });
            if (this["&request"].method === "GET") {
              const uri = xhrSessionCache.get(url);
              if (uri) {
                arguments[1] = uri;
              } else {
                this.onreadystatechange = () => {
                  if (this.readyState === 4 && this.status === 200) {
                    xhrSessionCache.set(url, this);
                  }
                };
              }
            }
             return _open.apply(this, arguments);
          } catch (e) {
            console.warn(e, this, ...arguments);
            this.error = e;
            return e;
          }
        },
      );
    })();

    (() => {
      /**
       * Intercedes the XMLHttpRequest `send` method to block certain requests or capture request body.
       * @symbol $send - Stores the original send method.
       */
      const $send = Symbol("*send");
      const _send = (self?.XMLHttpRequest?.prototype ?? {}).send;
      intercede(
        (self?.XMLHttpRequest ?? {}).prototype,
        "send",
        $send,
        function send() {
          try {
            if (arguments[0]) {
              (this?.["&request"] ?? {}).body = arguments[0];
            }
            return _send.apply(this, arguments);
          } catch (e) {
            this?.finish?.(e);
            console.warn(e, this, ...arguments);
            this.error = e;
            return e;
          }
        },
      );
    })();

    (() => {
      /**
       * Intercedes the XMLHttpRequest `setRequestHeader` method to record header values in the request metadata.
       * @symbol $setRequestHeader - Stores the original setRequestHeader method.
       */
      const $setRequestHeader = Symbol("*setRequestHeader");
      const _setRequestHeader = (self?.XMLHttpRequest?.prototype ?? {})
        .setRequestHeader;
      intercede(
        (self?.XMLHttpRequest ?? {}).prototype,
        "setRequestHeader",
        $setRequestHeader,
        function setRequestHeader(header, value) {
          try {
            _setRequestHeader.apply(this, header, value);
            if (this?.["&request"]?.headers?.get?.(header)) {
              this?.["&request"]?.headers?.set?.(
                header,
                this?.["&request"]?.headers?.get?.(header) + ", " + value,
              );
            } else {
              this?.["&request"]?.headers?.set?.(header, value);
            }
          } catch (e) {
            console.warn(e, this, ...arguments);
            this?.["&request"]?.headers?.set?.(header, e);
          }
        },
      );
    })();

    (() => {
      /**
       * Intercedes the XMLHttpRequest `abort` method.
       * @symbol $abort - Stores the original abort method.
       */
      const $abort = Symbol("*abort");
      const _abort = (self?.XMLHttpRequest?.prototype ?? {}).abort;
      intercede(
        (self?.XMLHttpRequest ?? {}).prototype,
        "abort",
        $abort,
        function abort() {
          try {
            return _abort.apply(this, arguments);
          } catch (e) {
            console.warn(e, this, ...arguments);
            this.error = e;
            return e;
          }
        },
      );
    })();

    (() => {
      /**
       * Intercedes the XMLHttpRequest `getAllResponseHeaders` method.
       * @symbol $getAllResponseHeaders - Stores the original getAllResponseHeaders method.
       */
      const $getAllResponseHeaders = Symbol("*getAllResponseHeaders");
      const _getAllResponseHeaders = (self?.XMLHttpRequest?.prototype ?? {})
        .getAllResponseHeaders;
      intercede(
        (self?.XMLHttpRequest ?? {}).prototype,
        "getAllResponseHeaders",
        $getAllResponseHeaders,
        function getAllResponseHeaders() {
          try {
            return _getAllResponseHeaders.apply(this, arguments);
          } catch (e) {
            console.warn(e, this, ...arguments);
            return Object.getOwnPropertyNames(e)
              .map((x) => `${x}: ${e[x]}`)
              .join("\n");
          }
        },
      );
    })();

    (() => {
      /**
       * Intercedes the XMLHttpRequest `getResponseHeader` method.
       * @symbol $getResponseHeader - Stores the original getResponseHeader method.
       */
      const $getResponseHeader = Symbol("*getResponseHeader");
      const _getResponseHeader = (self?.XMLHttpRequest?.prototype ?? {})
        .getResponseHeader;
      intercede(
        (self?.XMLHttpRequest ?? {}).prototype,
        "getResponseHeader",
        $getResponseHeader,
        function getResponseHeader() {
          try {
            return _getResponseHeader.apply(this, arguments);
          } catch (e) {
            console.warn(e, this, ...arguments);
            return e.message;
          }
        },
      );
    })();

    (() => {
      /**
       * Intercedes the XMLHttpRequest `overrideMimeType` method.
       * @symbol $overrideMimeType - Stores the original overrideMimeType method.
       */
      const $overrideMimeType = Symbol("*overrideMimeType");
      const _overrideMimeType = (self?.XMLHttpRequest?.prototype ?? {})
        .overrideMimeType;
      intercede(
        (self?.XMLHttpRequest ?? {}).prototype,
        "overrideMimeType",
        $overrideMimeType,
        function overrideMimeType() {
          try {
            return _overrideMimeType.apply(this, arguments);
          } catch (e) {
            console.warn(e, this, ...arguments);
            return e;
          }
        },
      );
    })();

    (() => {
      /**
       * Finishes an XMLHttpRequest with an error response, forcing readyState to 4 and setting the response to the error details.
       * @function finish
       * @param {Error} e - The error to handle.
       */
      (globalThis.XMLHttpRequest?.prototype ?? {}).finish = function finish(e) {
        objDefEnum(this, "readyState", (this.readyState ??= 0));
        while (this.readyState < 3) {
          objDefEnum(this, "readyState", ++this.readyState);
          this.dispatchEvent(new Event("readystatechange"));
        }

        this.readyState = 4;
        objDefEnum(this, "readyState", 4);
        this.status = 500;
        objDefEnum(this, "status", 500);
        this.statusText = e.message;
        objDefEnum(this, "statusText", e.message);
        const resText =
          Object.getOwnPropertyNames(e ?? {})
            .map((x) => `${x}: ${e?.[x]}`)
            ?.join?.("\n")
            ?.trim?.() || String(e);
        this.responseText = resText;
        objDefEnum(this, "responseText", resText);
        this.dispatchEvent(new Event("readystatechange"));
        this.dispatchEvent(new Event("loadstart"));
        this.dispatchEvent(new Event("load"));
        this.dispatchEvent(new Event("loadend"));
        this.error = e;
      };
    })();
    /**
     * Intercepts global XMLHttpRequest and replaces it with a custom wrapper for advanced handling.
     */
    (() => {
      /**
       * A symbol for storing the native XMLHttpRequest constructor.
       * @constant
       * @type {Symbol}
       */
      const $XMLHttpRequest = Symbol("*XMLHttpRequest");

      /**
       * A symbol for storing the response wrapper constructor.
       * @constant
       * @type {Symbol}
       */
      const $XMLHttpResponse = Symbol("*XMLHttpResponse");

      if (globalThis.XMLHttpRequest) {
        /**
         * A placeholder function for constructing an XMLHttpResponse wrapper if needed.
         * @constructor
         * @param {XMLHttpRequest} xhr - The underlying XHR to wrap.
         */
        globalThis[$XMLHttpResponse] = function XMLHttpResponse(xhr) {
          const res = xhr?.response;
        };

        ///////
        /**
         * Creates a "stream-like" object that accumulates chunks as text, enabling chainable string usage.
         * @function
         * @param {ReadableStream|Promise<ReadableStream>} stream - A readable stream or a promise that resolves to one.
         * @returns {Promise<string>} A promise that resolves to the combined text, with string-like properties.
         */
        const streang = function streang(stream) {
          const $txt = [];
          let $this = (async () => {
            if (stream instanceof Promise) {
              stream = await stream;
            }
            for await (const chunk of stream) {
              try {
                $txt.push(zdecode(chunk));
              } catch (e) {
                console.warn(e, chunk, stream);
                $txt.push(` ${e.message} `);
              }
            }
            const done = new String($txt.join(""));
            objDefProp(done, "done", true);
            return done;
          })();

          objDefProp($this, "toString", function toString() {
            return $txt.join("");
          });
          objDefProp($this, "valueOf", function valueOf() {
            return $txt.join("");
          });
          objDefProp($this, "toLocaleString", function toLocaleString() {
            return $txt.join("");
          });
          objDefProp($this, Symbol.toPrimitive, function toPrimitive() {
            return $txt.join("");
          });
          objDefProp($this, Symbol.toStringTag, function toStringTag() {
            return $txt.join("");
          });

          Object.defineProperty($this, "length", {
            get() {
              return $txt.join("").length;
            },
            set(val) {},
            enumerable: true,
            configurable: true,
          });

          /**
           * Internal helper to assign string-like functionality to the target based on the source prototype.
           * @function
           * @param {Object} target - The target object to modify.
           * @param {Object} src - The source whose methods/properties are being adopted.
           * @returns {Object} The augmented target object.
           */
          function _streang(target, src) {
            let excepts = ["prototype", "constructor", "__proto__"];
            let enums = [];
            let source = src;
            while (source) {
              for (let key in source) {
                try {
                  if (excepts.includes(key) || enums.includes(key)) {
                    continue;
                  }
                  (() => {
                    const $source = source;
                    if (typeof $source[key] == "function") {
                      objDefEnum(target, key, function () {
                        try {
                          return $txt.join("")[key](...arguments);
                        } catch (e) {
                          console.warn(e, this, ...arguments);
                        }
                      });
                    } else {
                      Object.defineProperty(target, key, {
                        get() {
                          try {
                            return $txt.join("")[key];
                          } catch (e) {
                            console.warn(e, this, ...arguments);
                          }
                        },
                        set(value) {
                          try {
                            $source[key] = value;
                          } catch (e) {
                            console.warn(e, this, ...arguments);
                          }
                        },
                        enumerable: true,
                        configurable: true,
                      });
                    }
                  })();
                  enums.push(key);
                } catch (e) {
                  continue;
                }
              }
              let props = [];
              for (let key of objectNames(source)) {
                try {
                  if (
                    enums.includes(key) ||
                    excepts.includes(key) ||
                    props.includes(key)
                  ) {
                    continue;
                  }
                  (() => {
                    const $source = source;
                    if (typeof $source[key] == "function") {
                      objDefProp(target, key, function () {
                        try {
                          return $txt.join("")[key](...arguments);
                        } catch (e) {
                          console.warn(e, this, ...arguments);
                        }
                      });
                    } else {
                      Object.defineProperty(target, key, {
                        get() {
                          try {
                            return $txt.join("")[key];
                          } catch (e) {
                            console.warn(e, this, ...arguments);
                          }
                        },
                        set(value) {
                          try {
                            $source[key] = value;
                          } catch (e) {
                            console.warn(e, this, ...arguments);
                          }
                        },
                        enumerable: false,
                        configurable: true,
                      });
                    }
                  })();
                } catch {
                  continue;
                }
                props.push(key);
              }
              for (let key of objectSymbols(source)) {
                try {
                  if (
                    enums.includes(key) ||
                    excepts.includes(key) ||
                    props.includes(key)
                  ) {
                    continue;
                  }
                  (() => {
                    const $source = source;
                    if (typeof $source[key] == "function") {
                      objDefProp(target, key, function () {
                        try {
                          return $txt.join("")[key](...arguments);
                        } catch (e) {
                          console.warn(e, this, ...arguments);
                        }
                      });
                    } else {
                      Object.defineProperty(target, key, {
                        get() {
                          try {
                            return $txt.join("")[key];
                          } catch (e) {
                            console.warn(e, this, ...arguments);
                          }
                        },
                        set(value) {
                          try {
                            $source[key] = value;
                          } catch (e) {
                            console.warn(e, this, ...arguments);
                          }
                        },
                        enumerable: false,
                        configurable: true,
                      });
                    }
                  })();
                } catch {
                  continue;
                }
                props.push(key);
              }
              source = objGetProto(source);
            }
            return target;
          }

          return _streang($this, String.prototype);
        };
        //////

        /**
         * Stores the native XMLHttpRequest constructor on a Symbol, then wraps XMLHttpRequest with custom behavior.
         */
        objDefProp(globalThis, $XMLHttpRequest, globalThis.XMLHttpRequest);

        /**
         * A custom constructor function for XMLHttpRequest that delegates to the real constructor but adds intercepts.
         * @constructor
         */
        globalThis.XMLHttpRequest = function XMLHttpRequest() {
          const $xhr = new globalThis[$XMLHttpRequest](...arguments);
          let $this;
          try {
            if (new.target) {
              $this = this;
            } else {
              $this = Object.create(null);
            }
            objDefProp($this,'&xhr',$xhr);
            objDefProp($this, "toString", function toString() {
              return $xhr.toString(...arguments);
            });
            objDefProp($this, "valueOf", function valueOf() {
              return $xhr;
            });
            objDefProp($this, "toLocaleString", function toLocaleString() {
              return $xhr.toLocaleString(...arguments);
            });
            objDefProp($this, Symbol.toPrimitive, function toPrimitive() {
              return $xhr;
            });
            objDefProp($this, Symbol.toStringTag, function toStringTag() {
              return $xhr.toString(...arguments);
            });
            objDefProp($this, "&xhr", $xhr);

            for (let x of [
              "channel",
              "mozAnon",
              "mozBackgroundRequest",
              "mozSystem",
              "readyState",
              "response",
              "responseType",
              "responseURL",
              "status",
              "statusText",
              "timeout",
              "upload",
              "withCredentials",
              "onreadystatechange",
            ]) {
              Object.defineProperty($this, x, {
                get() {
                  try {
                    return $xhr[x];
                  } catch (e) {
                    console.warn(e, this, ...arguments);
                    return e;
                  }
                },
                set(val) {
                  try {
                    $xhr[x] = val;
                  } catch (e) {
                    console.warn(e, this, ...arguments);
                    return e;
                  }
                },
                enumerable: true,
                configurable: true,
              });
            }

            Object.defineProperty($this, "responseText", {
              get() {
                try {
                  if ($xhr.responseType == "document") {
                    return docText($xhr.response);
                  }
                  if (typeof $xhr.response == "arrayBuffer") {
                    return text($xhr.response);
                  }
                  if (typeof $xhr.response == "json") {
                    return JSON.stringify($xhr.response);
                  }
                  if (typeof $xhr.response == "blob") {
                    return streang($xhr.response.stream());
                  }
                  return $xhr.responseText || $xhr.statusText;
                } catch (e) {
                  console.warn(e, this, ...arguments);
                  return e.message;
                }
              },
              set(val) {
                try {
                  $xhr["responseText"] = val;
                } catch (e) {
                  console.warn(e, this, ...arguments);
                  return e.message;
                }
              },
              enumerable: true,
              configurable: true,
            });

            Object.defineProperty($this, "responseXML", {
              get() {
                try {
                  if ($xhr.responseType == "document") {
                    return (
                      $xhr.responseXML ||
                      $xhr.response ||
                      textDoc($xhr.statusText)
                    );
                  }
                  if (typeof $xhr.response == "arrayBuffer") {
                    return textDoc(text($xhr.response));
                  }
                  if (typeof $xhr.response == "json") {
                    return textDoc(JSON.stringify($xhr.response));
                  }
                  if (typeof $xhr.response == "blob") {
                    return textDoc(streang($xhr.response.stream()));
                  }
                  return textDoc($xhr.responseText || $xhr.statusText);
                } catch (e) {
                  console.warn(e, this, ...arguments);
                  return textDoc(
                    Object.getOwnPropertyNames(e)
                      .map((x) => `${x}: ${e[x]}`)
                      .join("\n"),
                  );
                }
              },
              set(val) {
                try {
                  $xhr["responseText"] = val;
                } catch (e) {
                  console.warn(e, this, ...arguments);
                  return e.message;
                }
              },
              enumerable: true,
              configurable: true,
            });

            objDefEnum(
              $this,
              "addEventListener",
              function addEventListener(...args) {
                const type = args?.shift?.();
                const listener = args?.shift?.();
                return $xhr.addEventListener(
                  type,
                  listener.bind($this),
                  ...args,
                );
              },
            );
            objDefEnum($this, "abort", function abort() {
              return $xhr.abort(...arguments);
            });
            objDefEnum(
              $this,
              "getAllResponseHeaders",
              function getAllResponseHeaders() {
                return $xhr.getAllResponseHeaders(...arguments);
              },
            );
            objDefEnum(
              $this,
              "getResponseHeader",
              function getResponseHeader() {
                return $xhr.getResponseHeader(...arguments);
              },
            );
            objDefEnum($this, "open", function open() {
              return $xhr.open(...arguments);
            });
            objDefEnum($this, "overrideMimeType", function overrideMimeType() {
              return $xhr.overrideMimeType(...arguments);
            });
            objDefEnum($this, "send", function send() {
              return $xhr.send(...arguments);
            });
            objDefEnum(
              $this,
              "setAttributionReporting",
              function setAttributionReporting() {
                return $xhr.setAttributionReporting(...arguments);
              },
            );
            objDefEnum($this, "setRequestHeader", function setRequestHeader() {
              return $xhr.setRequestHeader(...arguments);
            });
            objDefEnum($this, "dispatchEvent", function dispatchEvent() {
              return $xhr.dispatchEvent(...arguments);
            });

            //dispatchEvent

            for (let x of [
              "onabort",
              "onerror",
              "onload",
              "onloadend",
              "onloadstart",
              "onprogress",
              "ontimeout",
              "onerror",
            ]) {
              Object.defineProperty($this, x, {
                get() {
                  try {
                    return $xhr[x];
                  } catch (e) {
                    console.warn(e, this, ...arguments);
                    return e;
                  }
                },
                set(val) {
                  try {
                    $this.addEventListener(x, val);
                  } catch (e) {
                    console.warn(e, this, ...arguments);
                    return e;
                  }
                },
                enumerable: true,
                configurable: true,
              });
            }
            Object.setPrototypeOf($this, globalThis[$XMLHttpRequest].prototype);
          } catch (e) {
            console.warn(e, $this, ...arguments);
          }
          return Object.setPrototypeOf($this, $xhr);
        };

        // Reassigning the prototypes properly so the custom constructor behaves correctly.
        assignProto(globalThis.XMLHttpRequest, globalThis[$XMLHttpRequest]);
        Object.setPrototypeOf(XMLHttpRequest, globalThis[$XMLHttpRequest]);
      }
    })();
  })();
})();
