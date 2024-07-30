/* eslint-disable no-undef */
var _WebAssembly$1 = typeof WebAssembly !== 'undefined'
    ? WebAssembly
    : typeof WXWebAssembly !== 'undefined'
        ? WXWebAssembly
        : undefined;
function validateImports(imports) {
    if (imports && typeof imports !== 'object') {
        throw new TypeError('imports must be an object or undefined');
    }
    return true;
}
function load(wasmInput, imports) {
    if (!wasmInput)
        throw new TypeError('Invalid wasm source');
    validateImports(imports);
    imports = imports !== null && imports !== void 0 ? imports : {};
    // Promise<string | URL | Response | BufferSource | WebAssembly.Module>
    try {
        var then = typeof wasmInput === 'object' && wasmInput !== null && 'then' in wasmInput ? wasmInput.then : undefined;
        if (typeof then === 'function') {
            return then.call(wasmInput, function (input) { return load(input, imports); });
        }
    }
    catch (_) { }
    // BufferSource
    if (wasmInput instanceof ArrayBuffer || ArrayBuffer.isView(wasmInput)) {
        return _WebAssembly$1.instantiate(wasmInput, imports);
    }
    // WebAssembly.Module
    if (wasmInput instanceof _WebAssembly$1.Module) {
        return _WebAssembly$1.instantiate(wasmInput, imports).then(function (instance) {
            return { instance: instance, module: wasmInput };
        });
    }
    // Response
    if (typeof Response !== 'undefined' && wasmInput instanceof Response) {
        return wasmInput.arrayBuffer().then(function (buffer) {
            return _WebAssembly$1.instantiate(buffer, imports);
        });
    }
    // string | URL
    var inputIsString = typeof wasmInput === 'string';
    if (inputIsString || (typeof URL !== 'undefined' && wasmInput instanceof URL)) {
        if (inputIsString && typeof wx !== 'undefined' && typeof __wxConfig !== 'undefined') {
            return _WebAssembly$1.instantiate(wasmInput, imports);
        }
        if (typeof fetch !== 'function') {
            throw new TypeError('wasm source can not be a string or URL in this environment');
        }
        if (typeof _WebAssembly$1.instantiateStreaming === 'function') {
            try {
                return _WebAssembly$1.instantiateStreaming(fetch(wasmInput), imports).catch(function () {
                    return load(fetch(wasmInput), imports);
                });
            }
            catch (_) {
                return load(fetch(wasmInput), imports);
            }
        }
        else {
            return load(fetch(wasmInput), imports);
        }
    }
    throw new TypeError('Invalid wasm source');
}
function loadSync(wasmInput, imports) {
    if (!wasmInput)
        throw new TypeError('Invalid wasm source');
    validateImports(imports);
    imports = imports !== null && imports !== void 0 ? imports : {};
    var module;
    if ((wasmInput instanceof ArrayBuffer) || ArrayBuffer.isView(wasmInput)) {
        module = new _WebAssembly$1.Module(wasmInput);
    }
    else if (wasmInput instanceof WebAssembly.Module) {
        module = wasmInput;
    }
    else {
        throw new TypeError('Invalid wasm source');
    }
    var instance = new _WebAssembly$1.Instance(module, imports);
    var source = { instance: instance, module: module };
    return source;
}

function createNapiModule(options) {
    var napiModule = (function () {
        var ENVIRONMENT_IS_NODE = null !== null   ;
        var ENVIRONMENT_IS_PTHREAD = Boolean(options.childThread);
        var reuseWorker = Boolean(options.reuseWorker);
        var wasmInstance;
        var wasmModule;
        var wasmMemory;
        var wasmTable;
        var _malloc;
        var _free;
        function abort(msg) {
            if (typeof _WebAssembly$1.RuntimeError === 'function') {
                throw new _WebAssembly$1.RuntimeError(msg);
            }
            throw Error(msg);
        }
        var napiModule = {
            imports: {
                env: {},
                napi: {},
                emnapi: {}
            },
            exports: {},
            emnapi: {},
            loaded: false,
            filename: '',
            childThread: Boolean(options.childThread),
            spawnThread: undefined,
            startThread: undefined,
            initWorker: undefined,
            executeAsyncWork: undefined,
            init: function (options) {
                if (napiModule.loaded)
                    return napiModule.exports;
                if (!options)
                    throw new TypeError('Invalid napi init options');
                var instance = options.instance;
                if (!(instance === null || instance === void 0 ? void 0 : instance.exports))
                    throw new TypeError('Invalid wasm instance');
                wasmInstance = instance;
                var exports = instance.exports;
                var module = options.module;
                var memory = options.memory || exports.memory;
                var table = options.table || exports.__indirect_function_table;
                if (!(module instanceof _WebAssembly$1.Module))
                    throw new TypeError('Invalid wasm module');
                if (!(memory instanceof _WebAssembly$1.Memory))
                    throw new TypeError('Invalid wasm memory');
                if (!(table instanceof _WebAssembly$1.Table))
                    throw new TypeError('Invalid wasm table');
                wasmModule = module;
                wasmMemory = memory;
                wasmTable = table;
                if (typeof exports.malloc !== 'function')
                    throw new TypeError('malloc is not exported');
                if (typeof exports.free !== 'function')
                    throw new TypeError('free is not exported');
                _malloc = exports.malloc;
                _free = exports.free;
                if (!napiModule.childThread) {
                    // main thread only
                    var moduleApiVersion = 8 /* Version.NODE_API_DEFAULT_MODULE_API_VERSION */;
                    var node_api_module_get_api_version_v1 = instance.exports.node_api_module_get_api_version_v1;
                    if (typeof node_api_module_get_api_version_v1 === 'function') {
                        moduleApiVersion = node_api_module_get_api_version_v1();
                    }
                    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
                    var envObject = napiModule.envObject || (napiModule.envObject = emnapiCtx.createEnv(napiModule.filename, moduleApiVersion, function (cb) { return (wasmTable.get(cb)); }, function (cb) { return (wasmTable.get(cb)); }, abort, emnapiNodeBinding));
                    var scope_1 = emnapiCtx.openScope(envObject);
                    try {
                        envObject.callIntoModule(function (_envObject) {
                            var exports = napiModule.exports;
                            var exportsHandle = scope_1.add(exports);
                            var napi_register_wasm_v1 = instance.exports.napi_register_wasm_v1;
                            var napiValue = napi_register_wasm_v1(_envObject.id, exportsHandle.id);
                            napiModule.exports = (!napiValue) ? exports : emnapiCtx.handleStore.get(napiValue).value;
                        });
                    }
                    finally {
                        emnapiCtx.closeScope(envObject, scope_1);
                    }
                    napiModule.loaded = true;
                    delete napiModule.envObject;
                    return napiModule.exports;
                }
            }
        };
        var emnapiCtx;
        var emnapiNodeBinding;
        var onCreateWorker;
        var err;
        if (!ENVIRONMENT_IS_PTHREAD) {
            var context = options.context;
            if (typeof context !== 'object' || context === null) {
                throw new TypeError("Invalid `options.context`. Use `import { getDefaultContext } from '@emnapi/runtime'`");
            }
            emnapiCtx = context;
        }
        else {
            emnapiCtx = options === null || options === void 0 ? void 0 : options.context;
            var postMsg = typeof options.postMessage === 'function'
                ? options.postMessage
                : typeof postMessage === 'function'
                    ? postMessage
                    : undefined;
            if (typeof postMsg !== 'function') {
                throw new TypeError('No postMessage found');
            }
            napiModule.postMessage = postMsg;
        }
        if (typeof options.filename === 'string') {
            napiModule.filename = options.filename;
        }
        if (typeof options.onCreateWorker === 'function') {
            onCreateWorker = options.onCreateWorker;
        }
        if (typeof options.print === 'function') {
            options.print;
        }
        else {
            console.log.bind(console);
        }
        if (typeof options.printErr === 'function') {
            err = options.printErr;
        }
        else {
            err = console.warn.bind(console);
        }
        if ('nodeBinding' in options) {
            var nodeBinding = options.nodeBinding;
            if (typeof nodeBinding !== 'object' || nodeBinding === null) {
                throw new TypeError('Invalid `options.nodeBinding`. Use @emnapi/node-binding package');
            }
            emnapiNodeBinding = nodeBinding;
        }
        var emnapiAsyncWorkPoolSize = 0;
        if ('asyncWorkPoolSize' in options) {
            if (typeof options.asyncWorkPoolSize !== 'number') {
                throw new TypeError('options.asyncWorkPoolSize must be a integer');
            }
            emnapiAsyncWorkPoolSize = options.asyncWorkPoolSize >> 0;
            if (emnapiAsyncWorkPoolSize > 1024) {
                emnapiAsyncWorkPoolSize = 1024;
            }
            else if (emnapiAsyncWorkPoolSize < -1024) {
                emnapiAsyncWorkPoolSize = -1024;
            }
        }
        var singleThreadAsyncWork = ENVIRONMENT_IS_PTHREAD ? false : (emnapiAsyncWorkPoolSize <= 0);
        function _emnapi_async_work_pool_size() {
            return Math.abs(emnapiAsyncWorkPoolSize);
        }
        napiModule.imports.env._emnapi_async_work_pool_size = _emnapi_async_work_pool_size;
        // ------------------------------ pthread -------------------------------
        function emnapiAddSendListener(worker) {
            if (!worker)
                return false;
            if (worker._emnapiSendListener)
                return true;
            var handler = function (e) {
                var data = e.data;
                var __emnapi__ = data.__emnapi__;
                if (__emnapi__ && __emnapi__.type === 'async-send') {
                    if (ENVIRONMENT_IS_PTHREAD) {
                        var postMessage_1 = napiModule.postMessage;
                        postMessage_1({ __emnapi__: __emnapi__ });
                    }
                    else {
                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
                        var callback = __emnapi__.payload.callback;
                        (wasmTable.get(callback))(__emnapi__.payload.data);
                    }
                }
            };
            var dispose = function () {
                {
                    worker.removeEventListener('message', handler, false);
                }
                delete worker._emnapiSendListener;
            };
            worker._emnapiSendListener = { handler: handler, dispose: dispose };
            {
                worker.addEventListener('message', handler, false);
            }
            return true;
        }
        napiModule.emnapi.addSendListener = emnapiAddSendListener;
        function terminateWorker(worker) {
            var tid = worker.__emnapi_tid;
            worker.terminate();
            worker.onmessage = function (e) {
                if (e.data.__emnapi__) {
                    err('received "' + e.data.__emnapi__.type + '" command from terminated worker: ' + tid);
                }
            };
        }
        function spawnThread(startArg, errorOrTid) {
            var isNewABI = errorOrTid !== undefined;
            if (!isNewABI) {
                errorOrTid = _malloc(8);
                if (!errorOrTid) {
                    return -48; /* ENOMEM */
                }
            }
            var struct = new Int32Array(wasmMemory.buffer, errorOrTid, 2);
            Atomics.store(struct, 0, 0);
            Atomics.store(struct, 1, 0);
            if (ENVIRONMENT_IS_PTHREAD) {
                var postMessage_2 = napiModule.postMessage;
                postMessage_2({
                    __emnapi__: {
                        type: 'spawn-thread',
                        payload: {
                            startArg: startArg,
                            errorOrTid: errorOrTid
                        }
                    }
                });
                Atomics.wait(struct, 1, 0);
                var isError = Atomics.load(struct, 0);
                var result = Atomics.load(struct, 1);
                if (isNewABI) {
                    return isError;
                }
                _free(errorOrTid);
                return isError ? -result : result;
            }
            var worker;
            try {
                worker = PThread.getNewWorker();
                if (!worker) {
                    throw new Error('failed to get new worker');
                }
            }
            catch (e) {
                var EAGAIN = 6;
                Atomics.store(struct, 0, 1);
                Atomics.store(struct, 1, EAGAIN);
                Atomics.notify(struct, 1);
                err(e.message);
                if (isNewABI) {
                    return 1;
                }
                _free(errorOrTid);
                return -EAGAIN;
            }
            var tid = PThread.nextWorkerID + 43;
            Atomics.store(struct, 0, 0);
            Atomics.store(struct, 1, tid);
            Atomics.notify(struct, 1);
            var WASI_THREADS_MAX_TID = 0x1FFFFFFF;
            PThread.nextWorkerID = (PThread.nextWorkerID + 1) % (WASI_THREADS_MAX_TID - 42);
            PThread.pthreads[tid] = worker;
            worker.__emnapi_tid = tid;
            PThread.runningWorkers.push(worker);
            worker.postMessage({
                __emnapi__: {
                    type: 'start',
                    payload: {
                        tid: tid,
                        arg: startArg
                    }
                }
            });
            if (isNewABI) {
                return 0;
            }
            _free(errorOrTid);
            return tid;
        }
        function startThread(tid, startArg) {
            if (napiModule.childThread) {
                if (typeof wasmInstance.exports.wasi_thread_start !== 'function') {
                    throw new TypeError('wasi_thread_start is not exported');
                }
                var postMessage_3 = napiModule.postMessage;
                wasmInstance.exports.wasi_thread_start(tid, startArg);
                postMessage_3({
                    __emnapi__: {
                        type: 'cleanup-thread',
                        payload: {
                            tid: tid
                        }
                    }
                });
            }
            else {
                throw new Error('startThread is only available in child threads');
            }
        }
        napiModule.spawnThread = spawnThread;
        napiModule.startThread = startThread;
        var PThread = {
            unusedWorkers: [],
            runningWorkers: [],
            pthreads: Object.create(null),
            nextWorkerID: 0,
            init: function () { },
            returnWorkerToPool: function (worker) {
                var tid = worker.__emnapi_tid;
                delete PThread.pthreads[tid];
                PThread.unusedWorkers.push(worker);
                PThread.runningWorkers.splice(PThread.runningWorkers.indexOf(worker), 1);
                delete worker.__emnapi_tid;
            },
            loadWasmModuleToWorker: function (worker) {
                if (worker.whenLoaded)
                    return worker.whenLoaded;
                worker.whenLoaded = new Promise(function (resolve, reject) {
                    worker.onmessage = function (e) {
                        if (e.data.__emnapi__) {
                            var type = e.data.__emnapi__.type;
                            var payload = e.data.__emnapi__.payload;
                            if (type === 'loaded') {
                                worker.loaded = true;
                                resolve(worker);
                                // if (payload.err) {
                                //   err('failed to load in child thread: ' + (payload.err.message || payload.err))
                                // }
                            }
                            else if (type === 'spawn-thread') {
                                spawnThread(payload.startArg, payload.errorOrTid);
                            }
                            else if (type === 'cleanup-thread') {
                                if (reuseWorker) {
                                    PThread.returnWorkerToPool(worker);
                                }
                                else {
                                    delete PThread.pthreads[payload.tid];
                                    PThread.runningWorkers.splice(PThread.runningWorkers.indexOf(worker), 1);
                                    terminateWorker(worker);
                                    delete worker.__emnapi_tid;
                                }
                            }
                        }
                    };
                    worker.onerror = function (e) {
                        var message = 'worker sent an error!';
                        // if (worker.pthread_ptr) {
                        //   message = 'Pthread ' + ptrToString(worker.pthread_ptr) + ' sent an error!'
                        // }
                        err(message + ' ' + e.message);
                        reject(e);
                        throw e;
                    };
                    // napiModule.emnapi.addSendListener(worker)
                    emnapiAddSendListener(worker);
                    // if (typeof emnapiTSFN !== 'undefined') {
                    //   emnapiTSFN.addListener(worker)
                    // }
                    try {
                        worker.postMessage({
                            __emnapi__: {
                                type: 'load',
                                payload: {
                                    wasmModule: wasmModule,
                                    wasmMemory: wasmMemory
                                }
                            }
                        });
                    }
                    catch (err) {
                        if (typeof SharedArrayBuffer === 'undefined' || !(wasmMemory.buffer instanceof SharedArrayBuffer)) {
                            throw new Error('Multithread features require shared wasm memory. ' +
                                'Try to compile with `-matomics -mbulk-memory` and use `--import-memory --shared-memory` during linking');
                        }
                        throw err;
                    }
                });
                return worker.whenLoaded;
            },
            allocateUnusedWorker: function () {
                if (typeof onCreateWorker !== 'function') {
                    throw new TypeError('`options.onCreateWorker` is not provided');
                }
                var worker = onCreateWorker({ type: 'thread' });
                PThread.unusedWorkers.push(worker);
                return worker;
            },
            getNewWorker: function () {
                if (reuseWorker) {
                    if (PThread.unusedWorkers.length === 0) {
                        var worker_1 = PThread.allocateUnusedWorker();
                        PThread.loadWasmModuleToWorker(worker_1);
                    }
                    return PThread.unusedWorkers.pop();
                }
                var worker = PThread.allocateUnusedWorker();
                PThread.loadWasmModuleToWorker(worker);
                return worker;
            }
        };
        /**
         * @__sig ipiip
         */
        function napi_set_last_error(env, error_code, engine_error_code, engine_reserved) {
            var envObject = emnapiCtx.envStore.get(env);
            return envObject.setLastError(error_code, engine_error_code, engine_reserved);
        }
        /**
         * @__sig ip
         */
        function napi_clear_last_error(env) {
            var envObject = emnapiCtx.envStore.get(env);
            return envObject.clearLastError();
        }
        /**
         * @__sig vppp
         */
        function _emnapi_get_node_version(major, minor, patch) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var versions = [0, 0, 0];
            var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
            HEAP_DATA_VIEW.setUint32(major, versions[0], true);
            HEAP_DATA_VIEW.setUint32(minor, versions[1], true);
            HEAP_DATA_VIEW.setUint32(patch, versions[2], true);
        }
        /**
         * @__sig v
         * @__deps $runtimeKeepalivePush
         */
        function _emnapi_runtime_keepalive_push() {
        }
        /**
         * @__sig v
         * @__deps $runtimeKeepalivePop
         */
        function _emnapi_runtime_keepalive_pop() {
        }
        /**
         * @__sig vpp
         */
        function _emnapi_set_immediate(callback, data) {
            emnapiCtx.feature.setImmediate(function () {
                (wasmTable.get(callback))(data);
            });
        }
        /**
         * @__sig vpp
         */
        function _emnapi_next_tick(callback, data) {
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            Promise.resolve().then(function () {
                (wasmTable.get(callback))(data);
            });
        }
        /**
         * @__sig vipppi
         */
        function _emnapi_callback_into_module(forceUncaught, env, callback, data, close_scope_if_throw) {
            var envObject = emnapiCtx.envStore.get(env);
            var scope = emnapiCtx.openScope(envObject);
            try {
                envObject.callbackIntoModule(Boolean(forceUncaught), function () {
                    (wasmTable.get(callback))(env, data);
                });
            }
            catch (err) {
                emnapiCtx.closeScope(envObject, scope);
                if (close_scope_if_throw) {
                    emnapiCtx.closeScope(envObject);
                }
                throw err;
            }
            emnapiCtx.closeScope(envObject, scope);
        }
        /**
         * @__sig vipppp
         */
        function _emnapi_call_finalizer(forceUncaught, env, callback, data, hint) {
            var envObject = emnapiCtx.envStore.get(env);
            envObject.callFinalizerInternal(forceUncaught, callback, data, hint);
        }
        /**
         * @__sig v
         */
        function _emnapi_ctx_increase_waiting_request_counter() {
            emnapiCtx.increaseWaitingRequestCounter();
        }
        /**
         * @__sig v
         */
        function _emnapi_ctx_decrease_waiting_request_counter() {
            emnapiCtx.decreaseWaitingRequestCounter();
        }
        function $emnapiSetValueI64(result, numberValue) {
            var tempDouble;
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var tempI64 = [
                numberValue >>> 0,
                (tempDouble = numberValue, +Math.abs(tempDouble) >= 1 ? tempDouble > 0 ? (Math.min(+Math.floor(tempDouble / 4294967296), 4294967295) | 0) >>> 0 : ~~+Math.ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0)
            ];
            var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
            HEAP_DATA_VIEW.setInt32(result, tempI64[0], true);
            HEAP_DATA_VIEW.setInt32(result + 4, tempI64[1], true);
        }
        var utilMod = /*#__PURE__*/ Object.freeze({
            __proto__: null,
            $emnapiSetValueI64: $emnapiSetValueI64,
            _emnapi_call_finalizer: _emnapi_call_finalizer,
            _emnapi_callback_into_module: _emnapi_callback_into_module,
            _emnapi_ctx_decrease_waiting_request_counter: _emnapi_ctx_decrease_waiting_request_counter,
            _emnapi_ctx_increase_waiting_request_counter: _emnapi_ctx_increase_waiting_request_counter,
            _emnapi_get_node_version: _emnapi_get_node_version,
            _emnapi_next_tick: _emnapi_next_tick,
            _emnapi_runtime_keepalive_pop: _emnapi_runtime_keepalive_pop,
            _emnapi_runtime_keepalive_push: _emnapi_runtime_keepalive_push,
            _emnapi_set_immediate: _emnapi_set_immediate,
            napi_clear_last_error: napi_clear_last_error,
            napi_set_last_error: napi_set_last_error
        });
        function emnapiGetWorkerByPthreadPtr(pthreadPtr) {
            var view = new DataView(wasmMemory.buffer);
            /**
             * wasi-sdk-20.0+threads
             *
             * struct pthread {
             *   struct pthread *self;        // 0
             *   struct pthread *prev, *next; // 4, 8
             *   uintptr_t sysinfo;           // 12
             *   uintptr_t canary;            // 16
             *   int tid;                     // 20
             *   // ...
             * }
             */
            var tidOffset = 20;
            var tid = view.getInt32(pthreadPtr + tidOffset, true);
            var worker = PThread.pthreads[tid];
            return worker;
        }
        /** @__sig vp */
        function _emnapi_worker_unref(pthreadPtr) {
            if (ENVIRONMENT_IS_PTHREAD)
                return;
            var worker = emnapiGetWorkerByPthreadPtr(pthreadPtr);
            if (worker && typeof worker.unref === 'function') {
                worker.unref();
            }
        }
        /** @__sig vipp */
        function _emnapi_async_send_js(type, callback, data) {
            if (ENVIRONMENT_IS_PTHREAD) {
                var postMessage_1 = napiModule.postMessage;
                postMessage_1({
                    __emnapi__: {
                        type: 'async-send',
                        payload: {
                            callback: callback,
                            data: data
                        }
                    }
                });
            }
            else {
                switch (type) {
                    case 0:
                        _emnapi_set_immediate(callback, data);
                        break;
                    case 1:
                        _emnapi_next_tick(callback, data);
                        break;
                }
            }
        }
        // function ptrToString (ptr: number): string {
        //   return '0x' + ('00000000' + ptr.toString(16)).slice(-8)
        // }
        var uvThreadpoolReadyResolve;
        var uvThreadpoolReady = new Promise(function (resolve) {
            uvThreadpoolReadyResolve = function () {
                uvThreadpoolReady.ready = true;
                resolve();
            };
        });
        uvThreadpoolReady.ready = false;
        /** @__sig i */
        function _emnapi_is_main_browser_thread() {
            return (typeof window !== 'undefined' && typeof document !== 'undefined' && !ENVIRONMENT_IS_NODE) ? 1 : 0;
        }
        /** @__sig vppi */
        function _emnapi_after_uvthreadpool_ready(callback, q, type) {
            if (uvThreadpoolReady.ready) {
                (wasmTable.get(callback))(q, type);
            }
            else {
                uvThreadpoolReady.then(function () {
                    (wasmTable.get(callback))(q, type);
                });
            }
        }
        /** @__sig vpi */
        function _emnapi_tell_js_uvthreadpool(threads, size) {
            var p = [];
            var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
            var _loop_1 = function (i) {
                var pthreadPtr = HEAP_DATA_VIEW.getInt32(threads + i * 4, true);
                var worker = emnapiGetWorkerByPthreadPtr(pthreadPtr);
                p.push(new Promise(function (resolve) {
                    var handler = function (e) {
                        var data = e.data;
                        var __emnapi__ = data.__emnapi__;
                        if (__emnapi__ && __emnapi__.type === 'async-thread-ready') {
                            resolve();
                            if (worker && typeof worker.unref === 'function') {
                                worker.unref();
                            }
                            {
                                worker.removeEventListener('message', handler);
                            }
                        }
                    };
                    {
                        worker.addEventListener('message', handler);
                    }
                }));
            };
            for (var i = 0; i < size; i++) {
                _loop_1(i);
            }
            Promise.all(p).then(uvThreadpoolReadyResolve);
        }
        /** @__sig v */
        function _emnapi_emit_async_thread_ready() {
            if (!ENVIRONMENT_IS_PTHREAD)
                return;
            var postMessage = napiModule.postMessage;
            postMessage({
                __emnapi__: {
                    type: 'async-thread-ready',
                    payload: {}
                }
            });
        }
        var asyncMod = /*#__PURE__*/ Object.freeze({
            __proto__: null,
            _emnapi_after_uvthreadpool_ready: _emnapi_after_uvthreadpool_ready,
            _emnapi_async_send_js: _emnapi_async_send_js,
            _emnapi_emit_async_thread_ready: _emnapi_emit_async_thread_ready,
            _emnapi_is_main_browser_thread: _emnapi_is_main_browser_thread,
            _emnapi_tell_js_uvthreadpool: _emnapi_tell_js_uvthreadpool,
            _emnapi_worker_unref: _emnapi_worker_unref
        });
        /* eslint-disable @typescript-eslint/indent */
        /** @__sig ipjp */
        function napi_adjust_external_memory(env, change_in_bytes, adjusted_value) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            var envObject = emnapiCtx.envStore.get(env);
            if (!adjusted_value)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            var change_in_bytes_number = Number(change_in_bytes);
            if (change_in_bytes_number < 0) {
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            }
            var old_size = wasmMemory.buffer.byteLength;
            var new_size = old_size + change_in_bytes_number;
            new_size = new_size + ((65536 - new_size % 65536) % 65536);
            if (wasmMemory.grow((new_size - old_size + 65535) >> 16) === -1) {
                return envObject.setLastError(9 /* napi_status.napi_generic_failure */);
            }
            if (emnapiCtx.feature.supportBigInt) {
                var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
                HEAP_DATA_VIEW.setBigInt64(adjusted_value, BigInt(wasmMemory.buffer.byteLength), true);
            }
            else {
                $emnapiSetValueI64(adjusted_value, wasmMemory.buffer.byteLength);
            }
            return envObject.clearLastError();
        }
        var memoryMod = /*#__PURE__*/ Object.freeze({
            __proto__: null,
            napi_adjust_external_memory: napi_adjust_external_memory
        });
        /**
         * @__postset
         * ```
         * emnapiAWST.init();
         * ```
         */
        var emnapiAWST = {
            idGen: {},
            values: [undefined],
            queued: new Set(),
            pending: [],
            init: function () {
                var idGen = {
                    nextId: 1,
                    list: [],
                    generate: function () {
                        var id;
                        if (idGen.list.length) {
                            id = idGen.list.shift();
                        }
                        else {
                            id = idGen.nextId;
                            idGen.nextId++;
                        }
                        return id;
                    },
                    reuse: function (id) {
                        idGen.list.push(id);
                    }
                };
                emnapiAWST.idGen = idGen;
                emnapiAWST.values = [undefined];
                emnapiAWST.queued = new Set();
                emnapiAWST.pending = [];
            },
            create: function (env, resource, resourceName, execute, complete, data) {
                var asyncId = 0;
                var triggerAsyncId = 0;
                if (emnapiNodeBinding) {
                    var asyncContext = emnapiNodeBinding.node.emitAsyncInit(resource, resourceName, -1);
                    asyncId = asyncContext.asyncId;
                    triggerAsyncId = asyncContext.triggerAsyncId;
                }
                var id = emnapiAWST.idGen.generate();
                emnapiAWST.values[id] = {
                    env: env,
                    id: id,
                    resource: resource,
                    asyncId: asyncId,
                    triggerAsyncId: triggerAsyncId,
                    status: 0,
                    execute: execute,
                    complete: complete,
                    data: data
                };
                return id;
            },
            callComplete: function (work, status) {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                var complete = work.complete;
                var env = work.env;
                var data = work.data;
                var callback = function () {
                    if (!complete)
                        return;
                    var envObject = emnapiCtx.envStore.get(env);
                    var scope = emnapiCtx.openScope(envObject);
                    try {
                        envObject.callbackIntoModule(true, function () {
                            (wasmTable.get(complete))(env, status, data);
                        });
                    }
                    finally {
                        emnapiCtx.closeScope(envObject, scope);
                    }
                };
                if (emnapiNodeBinding) {
                    emnapiNodeBinding.node.makeCallback(work.resource, callback, [], {
                        asyncId: work.asyncId,
                        triggerAsyncId: work.triggerAsyncId
                    });
                }
                else {
                    callback();
                }
            },
            queue: function (id) {
                var work = emnapiAWST.values[id];
                if (!work)
                    return;
                if (work.status === 0) {
                    work.status = 1;
                    if (emnapiAWST.queued.size >= (Math.abs(emnapiAsyncWorkPoolSize) || 4)) {
                        emnapiAWST.pending.push(id);
                        return;
                    }
                    emnapiAWST.queued.add(id);
                    var env_1 = work.env;
                    var data_1 = work.data;
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    var execute = work.execute;
                    work.status = 2;
                    emnapiCtx.feature.setImmediate(function () {
                        (wasmTable.get(execute))(env_1, data_1);
                        emnapiAWST.queued.delete(id);
                        work.status = 3;
                        emnapiCtx.feature.setImmediate(function () {
                            emnapiAWST.callComplete(work, 0 /* napi_status.napi_ok */);
                        });
                        if (emnapiAWST.pending.length > 0) {
                            var nextWorkId = emnapiAWST.pending.shift();
                            emnapiAWST.values[nextWorkId].status = 0;
                            emnapiAWST.queue(nextWorkId);
                        }
                    });
                }
            },
            cancel: function (id) {
                var index = emnapiAWST.pending.indexOf(id);
                if (index !== -1) {
                    var work_1 = emnapiAWST.values[id];
                    if (work_1 && (work_1.status === 1)) {
                        work_1.status = 4;
                        emnapiAWST.pending.splice(index, 1);
                        emnapiCtx.feature.setImmediate(function () {
                            emnapiAWST.callComplete(work_1, 11 /* napi_status.napi_cancelled */);
                        });
                        return 0 /* napi_status.napi_ok */;
                    }
                    else {
                        return 9 /* napi_status.napi_generic_failure */;
                    }
                }
                return 9 /* napi_status.napi_generic_failure */;
            },
            remove: function (id) {
                var work = emnapiAWST.values[id];
                if (!work)
                    return;
                if (emnapiNodeBinding) {
                    emnapiNodeBinding.node.emitAsyncDestroy({
                        asyncId: work.asyncId,
                        triggerAsyncId: work.triggerAsyncId
                    });
                }
                emnapiAWST.values[id] = undefined;
                emnapiAWST.idGen.reuse(id);
            }
        };
        /** @__sig vppdp */
        function _emnapi_node_emit_async_init(async_resource, async_resource_name, trigger_async_id, result) {
            if (!emnapiNodeBinding)
                return;
            var resource = emnapiCtx.handleStore.get(async_resource).value;
            var resource_name = emnapiCtx.handleStore.get(async_resource_name).value;
            var asyncContext = emnapiNodeBinding.node.emitAsyncInit(resource, resource_name, trigger_async_id);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var asyncId = asyncContext.asyncId;
            var triggerAsyncId = asyncContext.triggerAsyncId;
            if (result) {
                var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
                HEAP_DATA_VIEW.setFloat64(result, asyncId, true);
                HEAP_DATA_VIEW.setFloat64(result + 8, triggerAsyncId, true);
            }
        }
        /** @__sig vdd */
        function _emnapi_node_emit_async_destroy(async_id, trigger_async_id) {
            if (!emnapiNodeBinding)
                return;
            emnapiNodeBinding.node.emitAsyncDestroy({
                asyncId: async_id,
                triggerAsyncId: trigger_async_id
            });
        }
        /* vpddp export function _emnapi_node_open_callback_scope (async_resource: napi_value, async_id: double, trigger_async_id: double, result: Pointer<int64_t>): void {
          if (!emnapiNodeBinding || !result) return
          const resource = emnapiCtx.handleStore.get(async_resource)!.value
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const nativeCallbackScopePointer = emnapiNodeBinding.node.openCallbackScope(resource, {
            asyncId: async_id,
            triggerAsyncId: trigger_async_id
          })
    
          from64('result')
          $_TODO_makeSetValue('result', 0, 'nativeCallbackScopePointer', 'i64')
        }
    
        vp
        export function _emnapi_node_close_callback_scope (scope: Pointer<int64_t>): void {
          if (!emnapiNodeBinding || !scope) return
          from64('scope')
          const nativeCallbackScopePointer = $_TODO_makeGetValue('scope', 0, 'i64')
          emnapiNodeBinding.node.closeCallbackScope(BigInt(nativeCallbackScopePointer))
        } */
        /** @__sig ipppppddp */
        function _emnapi_node_make_callback(env, async_resource, cb, argv, size, async_id, trigger_async_id, result) {
            var i = 0;
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var v;
            if (!emnapiNodeBinding)
                return;
            var resource = emnapiCtx.handleStore.get(async_resource).value;
            var callback = emnapiCtx.handleStore.get(cb).value;
            size = size >>> 0;
            var arr = Array(size);
            var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
            for (; i < size; i++) {
                var argVal = HEAP_DATA_VIEW.getInt32(argv + i * 4, true);
                arr[i] = emnapiCtx.handleStore.get(argVal).value;
            }
            var ret = emnapiNodeBinding.node.makeCallback(resource, callback, arr, {
                asyncId: async_id,
                triggerAsyncId: trigger_async_id
            });
            if (result) {
                var envObject = emnapiCtx.envStore.get(env);
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                v = envObject.ensureHandleId(ret);
                HEAP_DATA_VIEW.setInt32(result, v, true);
            }
        }
        /** @__sig ippp */
        function _emnapi_async_init_js(async_resource, async_resource_name, result) {
            if (!emnapiNodeBinding) {
                return 9 /* napi_status.napi_generic_failure */;
            }
            var resource;
            if (async_resource) {
                resource = Object(emnapiCtx.handleStore.get(async_resource).value);
            }
            var name = emnapiCtx.handleStore.get(async_resource_name).value;
            var ret = emnapiNodeBinding.napi.asyncInit(resource, name);
            if (ret.status !== 0)
                return ret.status;
            var numberValue = ret.value;
            if (!((numberValue >= (BigInt(-1) * (BigInt(1) << BigInt(63)))) && (numberValue < (BigInt(1) << BigInt(63))))) {
                numberValue = numberValue & ((BigInt(1) << BigInt(64)) - BigInt(1));
                if (numberValue >= (BigInt(1) << BigInt(63))) {
                    numberValue = numberValue - (BigInt(1) << BigInt(64));
                }
            }
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var low = Number(numberValue & BigInt(0xffffffff));
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var high = Number(numberValue >> BigInt(32));
            var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
            HEAP_DATA_VIEW.setInt32(result, low, true);
            HEAP_DATA_VIEW.setInt32(result + 4, high, true);
            return 0 /* napi_status.napi_ok */;
        }
        /** @__sig ip */
        function _emnapi_async_destroy_js(async_context) {
            if (!emnapiNodeBinding) {
                return 9 /* napi_status.napi_generic_failure */;
            }
            var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
            var low = HEAP_DATA_VIEW.getInt32(async_context, true);
            var high = HEAP_DATA_VIEW.getInt32(async_context + 4, true);
            var pointer = BigInt(low >>> 0) | (BigInt(high) << BigInt(32));
            var ret = emnapiNodeBinding.napi.asyncDestroy(pointer);
            if (ret.status !== 0)
                return ret.status;
            return 0 /* napi_status.napi_ok */;
        }
        // https://github.com/nodejs/node-addon-api/pull/1283
        /** @__sig ipppp */
        function napi_open_callback_scope(env, ignored, async_context_handle, result) {
            throw new Error('napi_open_callback_scope has not been implemented yet');
        }
        /** @__sig ipp */
        function napi_close_callback_scope(env, scope) {
            throw new Error('napi_close_callback_scope has not been implemented yet');
        }
        /** @__sig ippppppp */
        function napi_make_callback(env, async_context, recv, func, argc, argv, result) {
            var i = 0;
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var v;
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!envObject.tryCatch.isEmpty())
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            if (!envObject.canCallIntoJs())
                return envObject.setLastError(envObject.moduleApiVersion === 2147483647 /* Version.NAPI_VERSION_EXPERIMENTAL */ ? 23 /* napi_status.napi_cannot_run_js */ : 10 /* napi_status.napi_pending_exception */);
            envObject.clearLastError();
            try {
                if (!emnapiNodeBinding) {
                    return envObject.setLastError(9 /* napi_status.napi_generic_failure */);
                }
                if (!recv)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                if (argc > 0) {
                    if (!argv)
                        return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                }
                var v8recv = Object(emnapiCtx.handleStore.get(recv).value);
                var v8func = emnapiCtx.handleStore.get(func).value;
                if (typeof v8func !== 'function') {
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                }
                var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
                var low = HEAP_DATA_VIEW.getInt32(async_context, true);
                var high = HEAP_DATA_VIEW.getInt32(async_context + 4, true);
                var ctx = BigInt(low >>> 0) | (BigInt(high) << BigInt(32));
                argc = argc >>> 0;
                var arr = Array(argc);
                for (; i < argc; i++) {
                    var argVal = HEAP_DATA_VIEW.getInt32(argv + i * 4, true);
                    arr[i] = emnapiCtx.handleStore.get(argVal).value;
                }
                var ret = emnapiNodeBinding.napi.makeCallback(ctx, v8recv, v8func, arr);
                if (ret.error) {
                    throw ret.error;
                }
                if (ret.status !== 0 /* napi_status.napi_ok */)
                    return envObject.setLastError(ret.status);
                if (result) {
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    v = envObject.ensureHandleId(ret.value);
                    HEAP_DATA_VIEW.setInt32(result, v, true);
                }
                return envObject.getReturnStatus();
            }
            catch (err) {
                envObject.tryCatch.setError(err);
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            }
        }
        /** @__sig vp */
        function _emnapi_env_check_gc_access(env) {
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
        }
        var nodeMod = /*#__PURE__*/ Object.freeze({
            __proto__: null,
            _emnapi_async_destroy_js: _emnapi_async_destroy_js,
            _emnapi_async_init_js: _emnapi_async_init_js,
            _emnapi_env_check_gc_access: _emnapi_env_check_gc_access,
            _emnapi_node_emit_async_destroy: _emnapi_node_emit_async_destroy,
            _emnapi_node_emit_async_init: _emnapi_node_emit_async_init,
            _emnapi_node_make_callback: _emnapi_node_make_callback,
            napi_close_callback_scope: napi_close_callback_scope,
            napi_make_callback: napi_make_callback,
            napi_open_callback_scope: napi_open_callback_scope
        });
        /**
         * @__deps malloc
         * @__deps free
         * @__postset
         * ```
         * emnapiTSFN.init();
         * ```
         */
        var emnapiTSFN = {
            offset: {
                /* napi_ref */ resource: 0,
                /* double */ async_id: 8,
                /* double */ trigger_async_id: 16,
                /* size_t */ queue_size: 24,
                /* void* */ queue: 1 * 4 + 24,
                /* size_t */ thread_count: 2 * 4 + 24,
                /* bool */ is_closing: 3 * 4 + 24,
                /* atomic_uchar */ dispatch_state: 3 * 4 + 28,
                /* void* */ context: 3 * 4 + 32,
                /* size_t */ max_queue_size: 4 * 4 + 32,
                /* napi_ref */ ref: 5 * 4 + 32,
                /* napi_env */ env: 6 * 4 + 32,
                /* void* */ finalize_data: 7 * 4 + 32,
                /* napi_finalize */ finalize_cb: 8 * 4 + 32,
                /* napi_threadsafe_function_call_js */ call_js_cb: 9 * 4 + 32,
                /* bool */ handles_closing: 10 * 4 + 32,
                /* bool */ async_ref: 10 * 4 + 36,
                /* int32_t */ mutex: 10 * 4 + 40,
                /* int32_t */ cond: 10 * 4 + 44,
                end: 10 * 4 + 48
            },
            init: function () {
                if (typeof PThread !== 'undefined') {
                    PThread.unusedWorkers.forEach(emnapiTSFN.addListener);
                    PThread.runningWorkers.forEach(emnapiTSFN.addListener);
                    var __original_getNewWorker_1 = PThread.getNewWorker;
                    PThread.getNewWorker = function () {
                        var r = __original_getNewWorker_1.apply(this, arguments);
                        emnapiTSFN.addListener(r);
                        return r;
                    };
                }
            },
            addListener: function (worker) {
                if (!worker)
                    return false;
                if (worker._emnapiTSFNListener)
                    return true;
                var handler = function (e) {
                    var data = e.data;
                    var __emnapi__ = data.__emnapi__;
                    if (__emnapi__) {
                        var type = __emnapi__.type;
                        var payload = __emnapi__.payload;
                        if (type === 'tsfn-send') {
                            emnapiTSFN.dispatch(payload.tsfn);
                        }
                    }
                };
                var dispose = function () {
                    {
                        worker.removeEventListener('message', handler, false);
                    }
                    delete worker._emnapiTSFNListener;
                };
                worker._emnapiTSFNListener = { handler: handler, dispose: dispose };
                {
                    worker.addEventListener('message', handler, false);
                }
                return true;
            },
            initQueue: function (func) {
                var size = 2 * 4;
                var queue = _malloc(size);
                if (!queue)
                    return false;
                new Uint8Array(wasmMemory.buffer, queue, size).fill(0);
                emnapiTSFN.storeSizeTypeValue(func + emnapiTSFN.offset.queue, queue, false);
                return true;
            },
            destroyQueue: function (func) {
                var queue = emnapiTSFN.loadSizeTypeValue(func + emnapiTSFN.offset.queue, false);
                if (queue) {
                    _free(queue);
                }
            },
            pushQueue: function (func, data) {
                var queue = emnapiTSFN.loadSizeTypeValue(func + emnapiTSFN.offset.queue, false);
                var head = emnapiTSFN.loadSizeTypeValue(queue, false);
                var tail = emnapiTSFN.loadSizeTypeValue(queue + 4, false);
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                var size = 2 * 4;
                var node = _malloc(size);
                if (!node)
                    throw new Error('OOM');
                emnapiTSFN.storeSizeTypeValue(node, data, false);
                emnapiTSFN.storeSizeTypeValue(node + 4, 0, false);
                if (head === 0 && tail === 0) {
                    emnapiTSFN.storeSizeTypeValue(queue, node, false);
                    emnapiTSFN.storeSizeTypeValue(queue + 4, node, false);
                }
                else {
                    emnapiTSFN.storeSizeTypeValue(tail + 4, node, false);
                    emnapiTSFN.storeSizeTypeValue(queue + 4, node, false);
                }
                emnapiTSFN.addQueueSize(func);
            },
            shiftQueue: function (func) {
                var queue = emnapiTSFN.loadSizeTypeValue(func + emnapiTSFN.offset.queue, false);
                var head = emnapiTSFN.loadSizeTypeValue(queue, false);
                if (head === 0)
                    return 0;
                var node = head;
                var next = emnapiTSFN.loadSizeTypeValue(head + 4, false);
                emnapiTSFN.storeSizeTypeValue(queue, next, false);
                if (next === 0) {
                    emnapiTSFN.storeSizeTypeValue(queue + 4, 0, false);
                }
                emnapiTSFN.storeSizeTypeValue(node + 4, 0, false);
                var value = emnapiTSFN.loadSizeTypeValue(node, false);
                _free(node);
                emnapiTSFN.subQueueSize(func);
                return value;
            },
            push: function (func, data, mode) {
                var mutex = emnapiTSFN.getMutex(func);
                var cond = emnapiTSFN.getCond(func);
                var waitCondition = function () {
                    var queueSize = emnapiTSFN.getQueueSize(func);
                    var maxSize = emnapiTSFN.getMaxQueueSize(func);
                    var isClosing = emnapiTSFN.getIsClosing(func);
                    return queueSize >= maxSize && maxSize > 0 && !isClosing;
                };
                var isBrowserMain = typeof window !== 'undefined' && typeof document !== 'undefined' && !ENVIRONMENT_IS_NODE;
                return mutex.execute(function () {
                    while (waitCondition()) {
                        if (mode === 0 /* napi_threadsafe_function_call_mode.napi_tsfn_nonblocking */) {
                            return 15 /* napi_status.napi_queue_full */;
                        }
                        /**
                         * Browser JS main thread can not use `Atomics.wait`
                         *
                         * Related:
                         * https://github.com/nodejs/node/pull/32689
                         * https://github.com/nodejs/node/pull/33453
                         */
                        if (isBrowserMain) {
                            return 21 /* napi_status.napi_would_deadlock */;
                        }
                        cond.wait();
                    }
                    if (emnapiTSFN.getIsClosing(func)) {
                        if (emnapiTSFN.getThreadCount(func) === 0) {
                            return 1 /* napi_status.napi_invalid_arg */;
                        }
                        else {
                            emnapiTSFN.subThreadCount(func);
                            return 16 /* napi_status.napi_closing */;
                        }
                    }
                    else {
                        emnapiTSFN.pushQueue(func, data);
                        emnapiTSFN.send(func);
                        return 0 /* napi_status.napi_ok */;
                    }
                });
            },
            getMutex: function (func) {
                var index = func + emnapiTSFN.offset.mutex;
                var mutex = {
                    lock: function () {
                        var isBrowserMain = typeof window !== 'undefined' && typeof document !== 'undefined' && !ENVIRONMENT_IS_NODE;
                        var i32a = new Int32Array(wasmMemory.buffer, index, 1);
                        if (isBrowserMain) {
                            while (true) {
                                var oldValue = Atomics.compareExchange(i32a, 0, 0, 1);
                                if (oldValue === 0) {
                                    return;
                                }
                            }
                        }
                        else {
                            while (true) {
                                var oldValue = Atomics.compareExchange(i32a, 0, 0, 1);
                                if (oldValue === 0) {
                                    return;
                                }
                                Atomics.wait(i32a, 0, 1);
                            }
                        }
                    },
                    /* lockAsync () {
                      return new Promise<void>(resolve => {
                        const again = (): void => { fn() }
                        const fn = (): void => {
                          const i32a = new Int32Array(wasmMemory.buffer, index, 1)
                          const oldValue = Atomics.compareExchange(i32a, 0, 0, 1)
                          if (oldValue === 0) {
                            resolve()
                            return
                          }
                          (Atomics as any).waitAsync(i32a, 0, 1).value.then(again)
                        }
                        fn()
                      })
                    }, */
                    unlock: function () {
                        var i32a = new Int32Array(wasmMemory.buffer, index, 1);
                        var oldValue = Atomics.compareExchange(i32a, 0, 1, 0);
                        if (oldValue !== 1) {
                            throw new Error('Tried to unlock while not holding the mutex');
                        }
                        Atomics.notify(i32a, 0, 1);
                    },
                    execute: function (fn) {
                        mutex.lock();
                        try {
                            return fn();
                        }
                        finally {
                            mutex.unlock();
                        }
                    } /* ,
                    executeAsync<T> (fn: () => Promise<T>): Promise<T> {
                      return mutex.lockAsync().then(() => {
                        const r = fn()
                        mutex.unlock()
                        return r
                      }, (err) => {
                        mutex.unlock()
                        throw err
                      })
                    } */
                };
                return mutex;
            },
            getCond: function (func) {
                var index = func + emnapiTSFN.offset.cond;
                var mutex = emnapiTSFN.getMutex(func);
                var cond = {
                    wait: function () {
                        var i32a = new Int32Array(wasmMemory.buffer, index, 1);
                        var value = Atomics.load(i32a, 0);
                        mutex.unlock();
                        Atomics.wait(i32a, 0, value);
                        mutex.lock();
                    },
                    /* waitAsync () {
                      const i32a = new Int32Array(wasmMemory.buffer, index, 1)
                      const value = Atomics.load(i32a, 0)
                      mutex.unlock()
                      const lock = (): Promise<void> => mutex.lockAsync()
                      try {
                        return (Atomics as any).waitAsync(i32a, 0, value).value.then(lock, lock)
                      } catch (err) {
                        return lock()
                      }
                    }, */
                    signal: function () {
                        var i32a = new Int32Array(wasmMemory.buffer, index, 1);
                        Atomics.add(i32a, 0, 1);
                        Atomics.notify(i32a, 0, 1);
                    }
                };
                return cond;
            },
            getQueueSize: function (func) {
                return emnapiTSFN.loadSizeTypeValue(func + emnapiTSFN.offset.queue_size, true);
            },
            addQueueSize: function (func) {
                var offset = emnapiTSFN.offset.queue_size;
                var arr, index;
                arr = new Uint32Array(wasmMemory.buffer);
                index = (func + offset) >> 2;
                Atomics.add(arr, index, 1);
            },
            subQueueSize: function (func) {
                var offset = emnapiTSFN.offset.queue_size;
                var arr, index;
                arr = new Uint32Array(wasmMemory.buffer);
                index = (func + offset) >> 2;
                Atomics.sub(arr, index, 1);
            },
            getThreadCount: function (func) {
                return emnapiTSFN.loadSizeTypeValue(func + emnapiTSFN.offset.thread_count, true);
            },
            addThreadCount: function (func) {
                var offset = emnapiTSFN.offset.thread_count;
                var arr, index;
                arr = new Uint32Array(wasmMemory.buffer);
                index = (func + offset) >> 2;
                Atomics.add(arr, index, 1);
            },
            subThreadCount: function (func) {
                var offset = emnapiTSFN.offset.thread_count;
                var arr, index;
                arr = new Uint32Array(wasmMemory.buffer);
                index = (func + offset) >> 2;
                Atomics.sub(arr, index, 1);
            },
            getIsClosing: function (func) {
                return Atomics.load(new Int32Array(wasmMemory.buffer), (func + emnapiTSFN.offset.is_closing) >> 2);
            },
            setIsClosing: function (func, value) {
                Atomics.store(new Int32Array(wasmMemory.buffer), (func + emnapiTSFN.offset.is_closing) >> 2, value);
            },
            getHandlesClosing: function (func) {
                return Atomics.load(new Int32Array(wasmMemory.buffer), (func + emnapiTSFN.offset.handles_closing) >> 2);
            },
            setHandlesClosing: function (func, value) {
                Atomics.store(new Int32Array(wasmMemory.buffer), (func + emnapiTSFN.offset.handles_closing) >> 2, value);
            },
            getDispatchState: function (func) {
                return Atomics.load(new Uint32Array(wasmMemory.buffer), (func + emnapiTSFN.offset.dispatch_state) >> 2);
            },
            getContext: function (func) {
                return emnapiTSFN.loadSizeTypeValue(func + emnapiTSFN.offset.context, false);
            },
            getMaxQueueSize: function (func) {
                return emnapiTSFN.loadSizeTypeValue(func + emnapiTSFN.offset.max_queue_size, true);
            },
            getEnv: function (func) {
                return emnapiTSFN.loadSizeTypeValue(func + emnapiTSFN.offset.env, false);
            },
            getCallJSCb: function (func) {
                return emnapiTSFN.loadSizeTypeValue(func + emnapiTSFN.offset.call_js_cb, false);
            },
            getRef: function (func) {
                return emnapiTSFN.loadSizeTypeValue(func + emnapiTSFN.offset.ref, false);
            },
            getResource: function (func) {
                return emnapiTSFN.loadSizeTypeValue(func + emnapiTSFN.offset.resource, false);
            },
            getFinalizeCb: function (func) {
                return emnapiTSFN.loadSizeTypeValue(func + emnapiTSFN.offset.finalize_cb, false);
            },
            getFinalizeData: function (func) {
                return emnapiTSFN.loadSizeTypeValue(func + emnapiTSFN.offset.finalize_data, false);
            },
            loadSizeTypeValue: function (offset, unsigned) {
                var ret;
                var arr;
                if (unsigned) {
                    arr = new Uint32Array(wasmMemory.buffer);
                    ret = Atomics.load(arr, offset >> 2);
                    return ret;
                }
                else {
                    arr = new Int32Array(wasmMemory.buffer);
                    ret = Atomics.load(arr, offset >> 2);
                    return ret;
                }
            },
            storeSizeTypeValue: function (offset, value, unsigned) {
                var arr;
                if (unsigned) {
                    arr = new Uint32Array(wasmMemory.buffer);
                    Atomics.store(arr, offset >> 2, value);
                    return undefined;
                }
                else {
                    arr = new Int32Array(wasmMemory.buffer);
                    Atomics.store(arr, offset >> 2, value >>> 0);
                    return undefined;
                }
            },
            destroy: function (func) {
                emnapiTSFN.destroyQueue(func);
                var env = emnapiTSFN.getEnv(func);
                var envObject = emnapiCtx.envStore.get(env);
                var ref = emnapiTSFN.getRef(func);
                if (ref) {
                    emnapiCtx.refStore.get(ref).dispose();
                }
                emnapiCtx.removeCleanupHook(envObject, emnapiTSFN.cleanup, func);
                envObject.unref();
                var asyncRefOffset = (func + emnapiTSFN.offset.async_ref) >> 2;
                var arr = new Int32Array(wasmMemory.buffer);
                if (Atomics.load(arr, asyncRefOffset)) {
                    Atomics.store(arr, asyncRefOffset, 0);
                    emnapiCtx.decreaseWaitingRequestCounter();
                }
                var resource = emnapiTSFN.getResource(func);
                emnapiCtx.refStore.get(resource).dispose();
                if (emnapiNodeBinding) {
                    var view = new DataView(wasmMemory.buffer);
                    var asyncId = view.getFloat64(func + emnapiTSFN.offset.async_id, true);
                    var triggerAsyncId = view.getFloat64(func + emnapiTSFN.offset.trigger_async_id, true);
                    _emnapi_node_emit_async_destroy(asyncId, triggerAsyncId);
                }
                _free(func);
            },
            emptyQueueAndDelete: function (func) {
                var callJsCb = emnapiTSFN.getCallJSCb(func);
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                var context = emnapiTSFN.getContext(func);
                var data;
                while (emnapiTSFN.getQueueSize(func) > 0) {
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    data = emnapiTSFN.shiftQueue(func);
                    if (callJsCb) {
                        (wasmTable.get(callJsCb))(0, 0, context, data);
                    }
                }
                emnapiTSFN.destroy(func);
            },
            finalize: function (func) {
                var env = emnapiTSFN.getEnv(func);
                var envObject = emnapiCtx.envStore.get(env);
                emnapiCtx.openScope(envObject);
                var finalize = emnapiTSFN.getFinalizeCb(func);
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                var data = emnapiTSFN.getFinalizeData(func);
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                var context = emnapiTSFN.getContext(func);
                var f = function () {
                    envObject.callFinalizerInternal(0, finalize, data, context);
                };
                try {
                    if (finalize) {
                        if (emnapiNodeBinding) {
                            var resource = emnapiTSFN.getResource(func);
                            var resource_value = emnapiCtx.refStore.get(resource).get();
                            var resourceObject = emnapiCtx.handleStore.get(resource_value).value;
                            var view = new DataView(wasmMemory.buffer);
                            var asyncId = view.getFloat64(func + emnapiTSFN.offset.async_id, true);
                            var triggerAsyncId = view.getFloat64(func + emnapiTSFN.offset.trigger_async_id, true);
                            emnapiNodeBinding.node.makeCallback(resourceObject, f, [], {
                                asyncId: asyncId,
                                triggerAsyncId: triggerAsyncId
                            });
                        }
                        else {
                            f();
                        }
                    }
                    emnapiTSFN.emptyQueueAndDelete(func);
                }
                finally {
                    emnapiCtx.closeScope(envObject);
                }
            },
            cleanup: function (func) {
                emnapiTSFN.closeHandlesAndMaybeDelete(func, 1);
            },
            closeHandlesAndMaybeDelete: function (func, set_closing) {
                var env = emnapiTSFN.getEnv(func);
                var envObject = emnapiCtx.envStore.get(env);
                emnapiCtx.openScope(envObject);
                try {
                    if (set_closing) {
                        emnapiTSFN.getMutex(func).execute(function () {
                            emnapiTSFN.setIsClosing(func, 1);
                            if (emnapiTSFN.getMaxQueueSize(func) > 0) {
                                emnapiTSFN.getCond(func).signal();
                            }
                        });
                    }
                    if (emnapiTSFN.getHandlesClosing(func)) {
                        return;
                    }
                    emnapiTSFN.setHandlesClosing(func, 1);
                    emnapiCtx.feature.setImmediate(function () {
                        emnapiTSFN.finalize(func);
                    });
                }
                finally {
                    emnapiCtx.closeScope(envObject);
                }
            },
            dispatchOne: function (func) {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                var data = 0;
                var popped_value = false;
                var has_more = false;
                var mutex = emnapiTSFN.getMutex(func);
                var cond = emnapiTSFN.getCond(func);
                mutex.execute(function () {
                    if (emnapiTSFN.getIsClosing(func)) {
                        emnapiTSFN.closeHandlesAndMaybeDelete(func, 0);
                    }
                    else {
                        var size = emnapiTSFN.getQueueSize(func);
                        if (size > 0) {
                            data = emnapiTSFN.shiftQueue(func);
                            popped_value = true;
                            var maxQueueSize = emnapiTSFN.getMaxQueueSize(func);
                            if (size === maxQueueSize && maxQueueSize > 0) {
                                cond.signal();
                            }
                            size--;
                        }
                        if (size === 0) {
                            if (emnapiTSFN.getThreadCount(func) === 0) {
                                emnapiTSFN.setIsClosing(func, 1);
                                if (emnapiTSFN.getMaxQueueSize(func) > 0) {
                                    cond.signal();
                                }
                                emnapiTSFN.closeHandlesAndMaybeDelete(func, 0);
                            }
                        }
                        else {
                            has_more = true;
                        }
                    }
                });
                if (popped_value) {
                    var env = emnapiTSFN.getEnv(func);
                    var envObject_1 = emnapiCtx.envStore.get(env);
                    emnapiCtx.openScope(envObject_1);
                    var f = function () {
                        envObject_1.callbackIntoModule(false, function () {
                            var callJsCb = emnapiTSFN.getCallJSCb(func);
                            var ref = emnapiTSFN.getRef(func);
                            var js_callback = ref ? emnapiCtx.refStore.get(ref).get() : 0;
                            if (callJsCb) {
                                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                                var context = emnapiTSFN.getContext(func);
                                (wasmTable.get(callJsCb))(env, js_callback, context, data);
                            }
                            else {
                                var jsCallback = js_callback ? emnapiCtx.handleStore.get(js_callback).value : null;
                                if (typeof jsCallback === 'function') {
                                    jsCallback();
                                }
                            }
                        });
                    };
                    try {
                        if (emnapiNodeBinding) {
                            var resource = emnapiTSFN.getResource(func);
                            var resource_value = emnapiCtx.refStore.get(resource).get();
                            var resourceObject = emnapiCtx.handleStore.get(resource_value).value;
                            var view = new DataView(wasmMemory.buffer);
                            emnapiNodeBinding.node.makeCallback(resourceObject, f, [], {
                                asyncId: view.getFloat64(func + emnapiTSFN.offset.async_id, true),
                                triggerAsyncId: view.getFloat64(func + emnapiTSFN.offset.trigger_async_id, true)
                            });
                        }
                        else {
                            f();
                        }
                    }
                    finally {
                        emnapiCtx.closeScope(envObject_1);
                    }
                }
                return has_more;
            },
            dispatch: function (func) {
                var has_more = true;
                var iterations_left = 1000;
                var ui32a = new Uint32Array(wasmMemory.buffer);
                var index = (func + emnapiTSFN.offset.dispatch_state) >> 2;
                while (has_more && --iterations_left !== 0) {
                    Atomics.store(ui32a, index, 1);
                    has_more = emnapiTSFN.dispatchOne(func);
                    if (Atomics.exchange(ui32a, index, 0) !== 1) {
                        has_more = true;
                    }
                }
                if (has_more) {
                    emnapiTSFN.send(func);
                }
            },
            send: function (func) {
                var current_state = Atomics.or(new Uint32Array(wasmMemory.buffer), (func + emnapiTSFN.offset.dispatch_state) >> 2, 1 << 1);
                if ((current_state & 1) === 1) {
                    return;
                }
                if ((typeof ENVIRONMENT_IS_PTHREAD !== 'undefined') && ENVIRONMENT_IS_PTHREAD) {
                    postMessage({
                        __emnapi__: {
                            type: 'tsfn-send',
                            payload: {
                                tsfn: func
                            }
                        }
                    });
                }
                else {
                    emnapiCtx.feature.setImmediate(function () {
                        emnapiTSFN.dispatch(func);
                    });
                }
            }
        };
        /** @__sig ippppppppppp */
        function napi_create_threadsafe_function(env, func, async_resource, async_resource_name, max_queue_size, initial_thread_count, thread_finalize_data, thread_finalize_cb, context, call_js_cb, result) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!async_resource_name)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            max_queue_size = max_queue_size >>> 0;
            initial_thread_count = initial_thread_count >>> 0;
            if (initial_thread_count === 0) {
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            }
            if (!result)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            var ref = 0;
            if (!func) {
                if (!call_js_cb)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            }
            else {
                var funcValue = emnapiCtx.handleStore.get(func).value;
                if (typeof funcValue !== 'function') {
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                }
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                ref = emnapiCtx.createReference(envObject, func, 1, 1 /* Ownership.kUserland */).id;
            }
            var asyncResourceObject;
            if (async_resource) {
                asyncResourceObject = emnapiCtx.handleStore.get(async_resource).value;
                if (asyncResourceObject == null) {
                    return envObject.setLastError(2 /* napi_status.napi_object_expected */);
                }
                asyncResourceObject = Object(asyncResourceObject);
            }
            else {
                asyncResourceObject = {};
            }
            var resource = envObject.ensureHandleId(asyncResourceObject);
            var asyncResourceName = emnapiCtx.handleStore.get(async_resource_name).value;
            if (typeof asyncResourceName === 'symbol') {
                return envObject.setLastError(3 /* napi_status.napi_string_expected */);
            }
            asyncResourceName = String(asyncResourceName);
            var resource_name = envObject.ensureHandleId(asyncResourceName);
            // tsfn create
            var sizeofTSFN = emnapiTSFN.offset.end;
            var tsfn = _malloc(sizeofTSFN);
            if (!tsfn)
                return envObject.setLastError(9 /* napi_status.napi_generic_failure */);
            new Uint8Array(wasmMemory.buffer).subarray(tsfn, tsfn + sizeofTSFN).fill(0);
            var resourceRef = emnapiCtx.createReference(envObject, resource, 1, 1 /* Ownership.kUserland */);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var resource_ = resourceRef.id;
            var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
            HEAP_DATA_VIEW.setInt32(tsfn, resource_, true);
            if (!emnapiTSFN.initQueue(tsfn)) {
                _free(tsfn);
                resourceRef.dispose();
                return envObject.setLastError(9 /* napi_status.napi_generic_failure */);
            }
            _emnapi_node_emit_async_init(resource, resource_name, -1, tsfn + emnapiTSFN.offset.async_id);
            HEAP_DATA_VIEW.setUint32(tsfn + emnapiTSFN.offset.thread_count, initial_thread_count, true);
            HEAP_DATA_VIEW.setInt32(tsfn + emnapiTSFN.offset.context, context, true);
            HEAP_DATA_VIEW.setUint32(tsfn + emnapiTSFN.offset.max_queue_size, max_queue_size, true);
            HEAP_DATA_VIEW.setInt32(tsfn + emnapiTSFN.offset.ref, ref, true);
            HEAP_DATA_VIEW.setInt32(tsfn + emnapiTSFN.offset.env, env, true);
            HEAP_DATA_VIEW.setInt32(tsfn + emnapiTSFN.offset.finalize_data, thread_finalize_data, true);
            HEAP_DATA_VIEW.setInt32(tsfn + emnapiTSFN.offset.finalize_cb, thread_finalize_cb, true);
            HEAP_DATA_VIEW.setInt32(tsfn + emnapiTSFN.offset.call_js_cb, call_js_cb, true);
            emnapiCtx.addCleanupHook(envObject, emnapiTSFN.cleanup, tsfn);
            envObject.ref();
            emnapiCtx.increaseWaitingRequestCounter();
            HEAP_DATA_VIEW.setInt32(tsfn + emnapiTSFN.offset.async_ref, 1, true);
            HEAP_DATA_VIEW.setInt32(result, tsfn, true);
            return envObject.clearLastError();
        }
        /** @__sig ipp */
        function napi_get_threadsafe_function_context(func, result) {
            if (!func || !result) {
                abort();
                return 1 /* napi_status.napi_invalid_arg */;
            }
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var context = emnapiTSFN.getContext(func);
            var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
            HEAP_DATA_VIEW.setInt32(result, context, true);
            return 0 /* napi_status.napi_ok */;
        }
        /** @__sig ippi */
        function napi_call_threadsafe_function(func, data, mode) {
            if (!func) {
                abort();
                return 1 /* napi_status.napi_invalid_arg */;
            }
            return emnapiTSFN.push(func, data, mode);
        }
        /** @__sig ip */
        function napi_acquire_threadsafe_function(func) {
            if (!func) {
                abort();
                return 1 /* napi_status.napi_invalid_arg */;
            }
            var mutex = emnapiTSFN.getMutex(func);
            return mutex.execute(function () {
                if (emnapiTSFN.getIsClosing(func)) {
                    return 16 /* napi_status.napi_closing */;
                }
                emnapiTSFN.addThreadCount(func);
                return 0 /* napi_status.napi_ok */;
            });
        }
        /** @__sig ipi */
        function napi_release_threadsafe_function(func, mode) {
            if (!func) {
                abort();
                return 1 /* napi_status.napi_invalid_arg */;
            }
            var mutex = emnapiTSFN.getMutex(func);
            var cond = emnapiTSFN.getCond(func);
            return mutex.execute(function () {
                if (emnapiTSFN.getThreadCount(func) === 0) {
                    return 1 /* napi_status.napi_invalid_arg */;
                }
                emnapiTSFN.subThreadCount(func);
                if (emnapiTSFN.getThreadCount(func) === 0 || mode === 1 /* napi_threadsafe_function_release_mode.napi_tsfn_abort */) {
                    var isClosing = emnapiTSFN.getIsClosing(func);
                    if (!isClosing) {
                        var isClosingValue = (mode === 1 /* napi_threadsafe_function_release_mode.napi_tsfn_abort */) ? 1 : 0;
                        emnapiTSFN.setIsClosing(func, isClosingValue);
                        if (isClosingValue && emnapiTSFN.getMaxQueueSize(func) > 0) {
                            cond.signal();
                        }
                        emnapiTSFN.send(func);
                    }
                }
                return 0 /* napi_status.napi_ok */;
            });
        }
        /** @__sig ipp */
        function napi_unref_threadsafe_function(env, func) {
            if (!func) {
                abort();
                return 1 /* napi_status.napi_invalid_arg */;
            }
            var asyncRefOffset = (func + emnapiTSFN.offset.async_ref) >> 2;
            var arr = new Int32Array(wasmMemory.buffer);
            if (Atomics.load(arr, asyncRefOffset)) {
                Atomics.store(arr, asyncRefOffset, 0);
                emnapiCtx.decreaseWaitingRequestCounter();
            }
            return 0 /* napi_status.napi_ok */;
        }
        /** @__sig ipp */
        function napi_ref_threadsafe_function(env, func) {
            if (!func) {
                abort();
                return 1 /* napi_status.napi_invalid_arg */;
            }
            var asyncRefOffset = (func + emnapiTSFN.offset.async_ref) >> 2;
            var arr = new Int32Array(wasmMemory.buffer);
            if (!Atomics.load(arr, asyncRefOffset)) {
                Atomics.store(arr, asyncRefOffset, 1);
                emnapiCtx.increaseWaitingRequestCounter();
            }
            return 0 /* napi_status.napi_ok */;
        }
        var emnapiAWMT = {
            unusedWorkers: [],
            runningWorkers: [],
            workQueue: [],
            workerReady: null,
            offset: {
                /* napi_ref */ resource: 0,
                /* double */ async_id: 8,
                /* double */ trigger_async_id: 16,
                /* napi_env */ env: 24,
                /* void* */ data: 1 * 4 + 24,
                /* napi_async_execute_callback */ execute: 2 * 4 + 24,
                /* napi_async_complete_callback */ complete: 3 * 4 + 24,
                end: 4 * 4 + 24
            },
            init: function () {
                emnapiAWMT.unusedWorkers = [];
                emnapiAWMT.runningWorkers = [];
                emnapiAWMT.workQueue = [];
                emnapiAWMT.workerReady = null;
            },
            addListener: function (worker) {
                if (!worker)
                    return false;
                if (worker._emnapiAWMTListener)
                    return true;
                var handler = function (e) {
                    var data = e.data;
                    var __emnapi__ = data.__emnapi__;
                    if (__emnapi__) {
                        var type = __emnapi__.type;
                        var payload = __emnapi__.payload;
                        if (type === 'async-work-complete') {
                            emnapiCtx.decreaseWaitingRequestCounter();
                            emnapiAWMT.runningWorkers.splice(emnapiAWMT.runningWorkers.indexOf(worker), 1);
                            emnapiAWMT.unusedWorkers.push(worker);
                            emnapiAWMT.checkIdleWorker();
                            emnapiAWMT.callComplete(payload.work, 0 /* napi_status.napi_ok */);
                        }
                        else if (type === 'async-work-queue') {
                            emnapiAWMT.scheduleWork(payload.work);
                        }
                        else if (type === 'async-work-cancel') {
                            emnapiAWMT.cancelWork(payload.work);
                        }
                    }
                };
                var dispose = function () {
                    {
                        worker.removeEventListener('message', handler, false);
                    }
                    delete worker._emnapiAWMTListener;
                };
                worker._emnapiAWMTListener = { handler: handler, dispose: dispose };
                {
                    worker.addEventListener('message', handler, false);
                }
                return true;
            },
            initWorkers: function (n) {
                if (ENVIRONMENT_IS_PTHREAD) {
                    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
                    return emnapiAWMT.workerReady || (emnapiAWMT.workerReady = Promise.resolve());
                }
                if (emnapiAWMT.workerReady)
                    return emnapiAWMT.workerReady;
                if (typeof onCreateWorker !== 'function') {
                    throw new TypeError('`options.onCreateWorker` is not a function');
                }
                var promises = [];
                var args = [];
                if (!('emnapi_async_worker_create' in wasmInstance.exports)) {
                    throw new TypeError('`emnapi_async_worker_create` is not exported, please try to add `--export=emnapi_async_worker_create` to linker flags');
                }
                for (var i = 0; i < n; ++i) {
                    args.push(wasmInstance.exports.emnapi_async_worker_create());
                }
                try {
                    var _loop_1 = function (i) {
                        var worker = onCreateWorker({ type: 'async-work' });
                        var p = PThread.loadWasmModuleToWorker(worker);
                        emnapiAWMT.addListener(worker);
                        promises.push(p.then(function () {
                            if (typeof worker.unref === 'function') {
                                worker.unref();
                            }
                        }));
                        emnapiAWMT.unusedWorkers.push(worker);
                        var arg = args[i];
                        worker.threadBlockBase = arg;
                        worker.postMessage({
                            __emnapi__: {
                                type: 'async-worker-init',
                                payload: { arg: arg }
                            }
                        });
                    };
                    for (var i = 0; i < n; ++i) {
                        _loop_1(i);
                    }
                }
                catch (err) {
                    for (var i = 0; i < n; ++i) {
                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
                        var arg = args[i];
                        _free(arg);
                    }
                    throw err;
                }
                emnapiAWMT.workerReady = Promise.all(promises);
                return emnapiAWMT.workerReady;
            },
            checkIdleWorker: function () {
                if (emnapiAWMT.unusedWorkers.length > 0 && emnapiAWMT.workQueue.length > 0) {
                    var worker = emnapiAWMT.unusedWorkers.shift();
                    var work = emnapiAWMT.workQueue.shift();
                    emnapiAWMT.runningWorkers.push(worker);
                    worker.postMessage({
                        __emnapi__: {
                            type: 'async-work-execute',
                            payload: { work: work }
                        }
                    });
                }
            },
            getResource: function (work) {
                return emnapiTSFN.loadSizeTypeValue(work + emnapiAWMT.offset.resource, false);
            },
            getExecute: function (work) {
                return emnapiTSFN.loadSizeTypeValue(work + emnapiAWMT.offset.execute, false);
            },
            getComplete: function (work) {
                return emnapiTSFN.loadSizeTypeValue(work + emnapiAWMT.offset.complete, false);
            },
            getEnv: function (work) {
                return emnapiTSFN.loadSizeTypeValue(work + emnapiAWMT.offset.env, false);
            },
            getData: function (work) {
                return emnapiTSFN.loadSizeTypeValue(work + emnapiAWMT.offset.data, false);
            },
            scheduleWork: function (work) {
                var _a;
                if (ENVIRONMENT_IS_PTHREAD) {
                    var postMessage_1 = napiModule.postMessage;
                    postMessage_1({
                        __emnapi__: {
                            type: 'async-work-queue',
                            payload: { work: work }
                        }
                    });
                    return;
                }
                emnapiCtx.increaseWaitingRequestCounter();
                emnapiAWMT.workQueue.push(work);
                if ((_a = emnapiAWMT.workerReady) === null || _a === void 0 ? void 0 : _a.ready) {
                    emnapiAWMT.checkIdleWorker();
                }
                else {
                    var fail = function (err) {
                        emnapiCtx.decreaseWaitingRequestCounter();
                        throw err;
                    };
                    try {
                        emnapiAWMT.initWorkers(_emnapi_async_work_pool_size()).then(function () {
                            emnapiAWMT.workerReady.ready = true;
                            emnapiAWMT.checkIdleWorker();
                        }, fail);
                    }
                    catch (err) {
                        fail(err);
                    }
                }
            },
            cancelWork: function (work) {
                if (ENVIRONMENT_IS_PTHREAD) {
                    var postMessage_2 = napiModule.postMessage;
                    postMessage_2({
                        __emnapi__: {
                            type: 'async-work-cancel',
                            payload: { work: work }
                        }
                    });
                    return 0 /* napi_status.napi_ok */;
                }
                var index = emnapiAWMT.workQueue.indexOf(work);
                if (index !== -1) {
                    emnapiAWMT.workQueue.splice(index, 1);
                    emnapiCtx.feature.setImmediate(function () {
                        emnapiCtx.decreaseWaitingRequestCounter();
                        emnapiAWMT.checkIdleWorker();
                        emnapiAWMT.callComplete(work, 11 /* napi_status.napi_cancelled */);
                    });
                    return 0 /* napi_status.napi_ok */;
                }
                return 9 /* napi_status.napi_generic_failure */;
            },
            callComplete: function (work, status) {
                var complete = emnapiAWMT.getComplete(work);
                var env = emnapiAWMT.getEnv(work);
                var data = emnapiAWMT.getData(work);
                var envObject = emnapiCtx.envStore.get(env);
                var scope = emnapiCtx.openScope(envObject);
                var callback = function () {
                    if (!complete)
                        return;
                    envObject.callbackIntoModule(true, function () {
                        (wasmTable.get(complete))(env, status, data);
                    });
                };
                try {
                    if (emnapiNodeBinding) {
                        var resource = emnapiAWMT.getResource(work);
                        var resource_value = emnapiCtx.refStore.get(resource).get();
                        var resourceObject = emnapiCtx.handleStore.get(resource_value).value;
                        var view = new DataView(wasmMemory.buffer);
                        var asyncId = view.getFloat64(work + emnapiAWMT.offset.async_id, true);
                        var triggerAsyncId = view.getFloat64(work + emnapiAWMT.offset.trigger_async_id, true);
                        emnapiNodeBinding.node.makeCallback(resourceObject, callback, [], {
                            asyncId: asyncId,
                            triggerAsyncId: triggerAsyncId
                        });
                    }
                    else {
                        callback();
                    }
                }
                finally {
                    emnapiCtx.closeScope(envObject, scope);
                }
            }
        };
        /** @__sig ippppppp */
        var napi_create_async_work = singleThreadAsyncWork
            ? function (env, resource, resource_name, execute, complete, data, result) {
                if (!env)
                    return 1 /* napi_status.napi_invalid_arg */;
                // @ts-expect-error
                var envObject = emnapiCtx.envStore.get(env);
                envObject.checkGCAccess();
                if (!execute)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                if (!result)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                var resourceObject;
                if (resource) {
                    resourceObject = Object(emnapiCtx.handleStore.get(resource).value);
                }
                else {
                    resourceObject = {};
                }
                if (!resource_name)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                var resourceName = String(emnapiCtx.handleStore.get(resource_name).value);
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                var id = emnapiAWST.create(env, resourceObject, resourceName, execute, complete, data);
                var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
                HEAP_DATA_VIEW.setInt32(result, id, true);
                return envObject.clearLastError();
            }
            : function (env, resource, resource_name, execute, complete, data, result) {
                if (!env)
                    return 1 /* napi_status.napi_invalid_arg */;
                // @ts-expect-error
                var envObject = emnapiCtx.envStore.get(env);
                envObject.checkGCAccess();
                if (!execute)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                if (!result)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                var resourceObject;
                if (resource) {
                    resourceObject = Object(emnapiCtx.handleStore.get(resource).value);
                }
                else {
                    resourceObject = {};
                }
                if (!resource_name)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                var sizeofAW = emnapiAWMT.offset.end;
                var aw = _malloc(sizeofAW);
                if (!aw)
                    return envObject.setLastError(9 /* napi_status.napi_generic_failure */);
                new Uint8Array(wasmMemory.buffer).subarray(aw, aw + sizeofAW).fill(0);
                var s = envObject.ensureHandleId(resourceObject);
                var resourceRef = emnapiCtx.createReference(envObject, s, 1, 1 /* Ownership.kUserland */);
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                var resource_ = resourceRef.id;
                var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
                HEAP_DATA_VIEW.setInt32(aw, resource_, true);
                _emnapi_node_emit_async_init(s, resource_name, -1, aw + emnapiAWMT.offset.async_id);
                HEAP_DATA_VIEW.setInt32(aw + emnapiAWMT.offset.env, env, true);
                HEAP_DATA_VIEW.setInt32(aw + emnapiAWMT.offset.execute, execute, true);
                HEAP_DATA_VIEW.setInt32(aw + emnapiAWMT.offset.complete, complete, true);
                HEAP_DATA_VIEW.setInt32(aw + emnapiAWMT.offset.data, data, true);
                HEAP_DATA_VIEW.setInt32(result, aw, true);
                return envObject.clearLastError();
            };
        /** @__sig ipp */
        var napi_delete_async_work = singleThreadAsyncWork
            ? function (env, work) {
                if (!env)
                    return 1 /* napi_status.napi_invalid_arg */;
                // @ts-expect-error
                var envObject = emnapiCtx.envStore.get(env);
                envObject.checkGCAccess();
                if (!work)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                emnapiAWST.remove(work);
                return envObject.clearLastError();
            }
            : function (env, work) {
                if (!env)
                    return 1 /* napi_status.napi_invalid_arg */;
                // @ts-expect-error
                var envObject = emnapiCtx.envStore.get(env);
                envObject.checkGCAccess();
                if (!work)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                var resource = emnapiAWMT.getResource(work);
                emnapiCtx.refStore.get(resource).dispose();
                if (emnapiNodeBinding) {
                    var view = new DataView(wasmMemory.buffer);
                    var asyncId = view.getFloat64(work + emnapiAWMT.offset.async_id, true);
                    var triggerAsyncId = view.getFloat64(work + emnapiAWMT.offset.trigger_async_id, true);
                    _emnapi_node_emit_async_destroy(asyncId, triggerAsyncId);
                }
                _free(work);
                return envObject.clearLastError();
            };
        /** @__sig ipp */
        var napi_queue_async_work = singleThreadAsyncWork
            ? function (env, work) {
                if (!env)
                    return 1 /* napi_status.napi_invalid_arg */;
                var envObject = emnapiCtx.envStore.get(env);
                if (!work)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                emnapiAWST.queue(work);
                return envObject.clearLastError();
            }
            : function (env, work) {
                if (!env)
                    return 1 /* napi_status.napi_invalid_arg */;
                var envObject = emnapiCtx.envStore.get(env);
                if (!work)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                emnapiAWMT.scheduleWork(work);
                return envObject.clearLastError();
            };
        /** @__sig ipp */
        var napi_cancel_async_work = singleThreadAsyncWork
            ? function (env, work) {
                if (!env)
                    return 1 /* napi_status.napi_invalid_arg */;
                var envObject = emnapiCtx.envStore.get(env);
                if (!work)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                var status = emnapiAWST.cancel(work);
                if (status === 0 /* napi_status.napi_ok */)
                    return envObject.clearLastError();
                return envObject.setLastError(status);
            }
            : function (env, work) {
                if (!env)
                    return 1 /* napi_status.napi_invalid_arg */;
                var envObject = emnapiCtx.envStore.get(env);
                if (!work)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                var status = emnapiAWMT.cancelWork(work);
                if (status === 0 /* napi_status.napi_ok */)
                    return envObject.clearLastError();
                return envObject.setLastError(status);
            };
        function initWorker(startArg) {
            if (napiModule.childThread) {
                if (typeof wasmInstance.exports.emnapi_async_worker_init !== 'function') {
                    throw new TypeError('`emnapi_async_worker_init` is not exported, please try to add `--export=emnapi_async_worker_init` to linker flags');
                }
                wasmInstance.exports.emnapi_async_worker_init(startArg);
            }
            else {
                throw new Error('startThread is only available in child threads');
            }
        }
        function executeAsyncWork(work) {
            if (!ENVIRONMENT_IS_PTHREAD)
                return;
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var execute = emnapiAWMT.getExecute(work);
            var env = emnapiAWMT.getEnv(work);
            var data = emnapiAWMT.getData(work);
            (wasmTable.get(execute))(env, data);
            var postMessage = napiModule.postMessage;
            postMessage({
                __emnapi__: {
                    type: 'async-work-complete',
                    payload: { work: work }
                }
            });
        }
        napiModule.initWorker = initWorker;
        napiModule.executeAsyncWork = executeAsyncWork;
        var asyncWorkMod = /*#__PURE__*/ Object.freeze({
            __proto__: null,
            napi_cancel_async_work: napi_cancel_async_work,
            napi_create_async_work: napi_create_async_work,
            napi_delete_async_work: napi_delete_async_work,
            napi_queue_async_work: napi_queue_async_work
        });
        /**
         * @__deps malloc
         * @__deps free
         * @__postset
         * ```
         * emnapiExternalMemory.init();
         * ```
         */
        var emnapiExternalMemory = {
            registry: typeof FinalizationRegistry === 'function' ? new FinalizationRegistry(function (_pointer) { _free(_pointer); }) : undefined,
            table: new WeakMap(),
            wasmMemoryViewTable: new WeakMap(),
            init: function () {
                emnapiExternalMemory.registry = typeof FinalizationRegistry === 'function' ? new FinalizationRegistry(function (_pointer) { _free(_pointer); }) : undefined;
                emnapiExternalMemory.table = new WeakMap();
                emnapiExternalMemory.wasmMemoryViewTable = new WeakMap();
            },
            isDetachedArrayBuffer: function (arrayBuffer) {
                if (arrayBuffer.byteLength === 0) {
                    try {
                        // eslint-disable-next-line no-new
                        new Uint8Array(arrayBuffer);
                    }
                    catch (_) {
                        return true;
                    }
                }
                return false;
            },
            getArrayBufferPointer: function (arrayBuffer, shouldCopy) {
                var _a;
                var info = {
                    address: 0,
                    ownership: 0 /* Ownership.kRuntime */,
                    runtimeAllocated: 0
                };
                if (arrayBuffer === wasmMemory.buffer) {
                    return info;
                }
                var isDetached = emnapiExternalMemory.isDetachedArrayBuffer(arrayBuffer);
                if (emnapiExternalMemory.table.has(arrayBuffer)) {
                    var cachedInfo = emnapiExternalMemory.table.get(arrayBuffer);
                    if (isDetached) {
                        cachedInfo.address = 0;
                        return cachedInfo;
                    }
                    if (shouldCopy && cachedInfo.ownership === 0 /* Ownership.kRuntime */ && cachedInfo.runtimeAllocated === 1) {
                        new Uint8Array(wasmMemory.buffer).set(new Uint8Array(arrayBuffer), cachedInfo.address);
                    }
                    return cachedInfo;
                }
                if (isDetached || (arrayBuffer.byteLength === 0)) {
                    return info;
                }
                if (!shouldCopy) {
                    return info;
                }
                var pointer = _malloc(arrayBuffer.byteLength);
                if (!pointer)
                    throw new Error('Out of memory');
                new Uint8Array(wasmMemory.buffer).set(new Uint8Array(arrayBuffer), pointer);
                info.address = pointer;
                info.ownership = emnapiExternalMemory.registry ? 0 /* Ownership.kRuntime */ : 1 /* Ownership.kUserland */;
                info.runtimeAllocated = 1;
                emnapiExternalMemory.table.set(arrayBuffer, info);
                (_a = emnapiExternalMemory.registry) === null || _a === void 0 ? void 0 : _a.register(arrayBuffer, pointer);
                return info;
            },
            getOrUpdateMemoryView: function (view) {
                if (view.buffer === wasmMemory.buffer) {
                    if (!emnapiExternalMemory.wasmMemoryViewTable.has(view)) {
                        emnapiExternalMemory.wasmMemoryViewTable.set(view, {
                            Ctor: view.constructor,
                            address: view.byteOffset,
                            length: view instanceof DataView ? view.byteLength : view.length,
                            ownership: 1 /* Ownership.kUserland */,
                            runtimeAllocated: 0
                        });
                    }
                    return view;
                }
                var maybeOldWasmMemory = emnapiExternalMemory.isDetachedArrayBuffer(view.buffer) ||
                    ((typeof SharedArrayBuffer === 'function') && (view.buffer instanceof SharedArrayBuffer));
                if (maybeOldWasmMemory && emnapiExternalMemory.wasmMemoryViewTable.has(view)) {
                    var info = emnapiExternalMemory.wasmMemoryViewTable.get(view);
                    var Ctor = info.Ctor;
                    var newView = void 0;
                    var Buffer = emnapiCtx.feature.Buffer;
                    if (typeof Buffer === 'function' && Ctor === Buffer) {
                        newView = Buffer.from(wasmMemory.buffer, info.address, info.length);
                    }
                    else {
                        newView = new Ctor(wasmMemory.buffer, info.address, info.length);
                    }
                    emnapiExternalMemory.wasmMemoryViewTable.set(newView, info);
                    return newView;
                }
                return view;
            },
            getViewPointer: function (view, shouldCopy) {
                view = emnapiExternalMemory.getOrUpdateMemoryView(view);
                if (view.buffer === wasmMemory.buffer) {
                    if (emnapiExternalMemory.wasmMemoryViewTable.has(view)) {
                        var _a = emnapiExternalMemory.wasmMemoryViewTable.get(view), address_1 = _a.address, ownership_1 = _a.ownership, runtimeAllocated_1 = _a.runtimeAllocated;
                        return { address: address_1, ownership: ownership_1, runtimeAllocated: runtimeAllocated_1, view: view };
                    }
                    return { address: view.byteOffset, ownership: 1 /* Ownership.kUserland */, runtimeAllocated: 0, view: view };
                }
                var _b = emnapiExternalMemory.getArrayBufferPointer(view.buffer, shouldCopy), address = _b.address, ownership = _b.ownership, runtimeAllocated = _b.runtimeAllocated;
                return { address: address === 0 ? 0 : (address + view.byteOffset), ownership: ownership, runtimeAllocated: runtimeAllocated, view: view };
            }
        };
        /* eslint-disable @typescript-eslint/indent */
        /**
         * @__postset
         * ```
         * emnapiString.init();
         * ```
         */
        var emnapiString = {
            utf8Decoder: undefined,
            utf16Decoder: undefined,
            init: function () {
                var fallbackDecoder = {
                    decode: function (bytes) {
                        var inputIndex = 0;
                        var pendingSize = Math.min(0x1000, bytes.length + 1);
                        var pending = new Uint16Array(pendingSize);
                        var chunks = [];
                        var pendingIndex = 0;
                        for (;;) {
                            var more = inputIndex < bytes.length;
                            if (!more || (pendingIndex >= pendingSize - 1)) {
                                var subarray = pending.subarray(0, pendingIndex);
                                var arraylike = subarray;
                                chunks.push(String.fromCharCode.apply(null, arraylike));
                                if (!more) {
                                    return chunks.join('');
                                }
                                bytes = bytes.subarray(inputIndex);
                                inputIndex = 0;
                                pendingIndex = 0;
                            }
                            var byte1 = bytes[inputIndex++];
                            if ((byte1 & 0x80) === 0) {
                                pending[pendingIndex++] = byte1;
                            }
                            else if ((byte1 & 0xe0) === 0xc0) {
                                var byte2 = bytes[inputIndex++] & 0x3f;
                                pending[pendingIndex++] = ((byte1 & 0x1f) << 6) | byte2;
                            }
                            else if ((byte1 & 0xf0) === 0xe0) {
                                var byte2 = bytes[inputIndex++] & 0x3f;
                                var byte3 = bytes[inputIndex++] & 0x3f;
                                pending[pendingIndex++] = ((byte1 & 0x1f) << 12) | (byte2 << 6) | byte3;
                            }
                            else if ((byte1 & 0xf8) === 0xf0) {
                                var byte2 = bytes[inputIndex++] & 0x3f;
                                var byte3 = bytes[inputIndex++] & 0x3f;
                                var byte4 = bytes[inputIndex++] & 0x3f;
                                var codepoint = ((byte1 & 0x07) << 0x12) | (byte2 << 0x0c) | (byte3 << 0x06) | byte4;
                                if (codepoint > 0xffff) {
                                    codepoint -= 0x10000;
                                    pending[pendingIndex++] = (codepoint >>> 10) & 0x3ff | 0xd800;
                                    codepoint = 0xdc00 | codepoint & 0x3ff;
                                }
                                pending[pendingIndex++] = codepoint;
                            }
                            else ;
                        }
                    }
                };
                var utf8Decoder;
                utf8Decoder = typeof TextDecoder === 'function' ? new TextDecoder() : fallbackDecoder;
                emnapiString.utf8Decoder = utf8Decoder;
                var fallbackDecoder2 = {
                    decode: function (input) {
                        var bytes = new Uint16Array(input.buffer, input.byteOffset, input.byteLength / 2);
                        if (bytes.length <= 0x1000) {
                            return String.fromCharCode.apply(null, bytes);
                        }
                        var chunks = [];
                        var i = 0;
                        var len = 0;
                        for (; i < bytes.length; i += len) {
                            len = Math.min(0x1000, bytes.length - i);
                            chunks.push(String.fromCharCode.apply(null, bytes.subarray(i, i + len)));
                        }
                        return chunks.join('');
                    }
                };
                var utf16Decoder;
                utf16Decoder = typeof TextDecoder === 'function' ? new TextDecoder('utf-16le') : fallbackDecoder2;
                emnapiString.utf16Decoder = utf16Decoder;
            },
            lengthBytesUTF8: function (str) {
                var c;
                var len = 0;
                for (var i = 0; i < str.length; ++i) {
                    c = str.charCodeAt(i);
                    if (c <= 0x7F) {
                        len++;
                    }
                    else if (c <= 0x7FF) {
                        len += 2;
                    }
                    else if (c >= 0xD800 && c <= 0xDFFF) {
                        len += 4;
                        ++i;
                    }
                    else {
                        len += 3;
                    }
                }
                return len;
            },
            UTF8ToString: function (ptr, length) {
                if (!ptr || !length)
                    return '';
                ptr >>>= 0;
                var HEAPU8 = new Uint8Array(wasmMemory.buffer);
                var end = ptr;
                if (length === -1) {
                    for (; HEAPU8[end];)
                        ++end;
                }
                else {
                    end = ptr + (length >>> 0);
                }
                length = end - ptr;
                if (length <= 16) {
                    var idx = ptr;
                    var str = '';
                    while (idx < end) {
                        var u0 = HEAPU8[idx++];
                        if (!(u0 & 0x80)) {
                            str += String.fromCharCode(u0);
                            continue;
                        }
                        var u1 = HEAPU8[idx++] & 63;
                        if ((u0 & 0xE0) === 0xC0) {
                            str += String.fromCharCode(((u0 & 31) << 6) | u1);
                            continue;
                        }
                        var u2 = HEAPU8[idx++] & 63;
                        if ((u0 & 0xF0) === 0xE0) {
                            u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
                        }
                        else {
                            u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | (HEAPU8[idx++] & 63);
                        }
                        if (u0 < 0x10000) {
                            str += String.fromCharCode(u0);
                        }
                        else {
                            var ch = u0 - 0x10000;
                            str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
                        }
                    }
                    return str;
                }
                return emnapiString.utf8Decoder.decode(((typeof SharedArrayBuffer === "function" && HEAPU8.buffer instanceof SharedArrayBuffer) || (Object.prototype.toString.call(HEAPU8.buffer.constructor) === "[object SharedArrayBuffer]")) ? HEAPU8.slice(ptr, end) : HEAPU8.subarray(ptr, end));
            },
            stringToUTF8: function (str, outPtr, maxBytesToWrite) {
                var HEAPU8 = new Uint8Array(wasmMemory.buffer);
                var outIdx = outPtr;
                outIdx >>>= 0;
                if (!(maxBytesToWrite > 0)) {
                    return 0;
                }
                var startIdx = outIdx;
                var endIdx = outIdx + maxBytesToWrite - 1;
                for (var i = 0; i < str.length; ++i) {
                    var u = str.charCodeAt(i);
                    if (u >= 0xD800 && u <= 0xDFFF) {
                        var u1 = str.charCodeAt(++i);
                        u = 0x10000 + ((u & 0x3FF) << 10) | (u1 & 0x3FF);
                    }
                    if (u <= 0x7F) {
                        if (outIdx >= endIdx)
                            break;
                        HEAPU8[outIdx++] = u;
                    }
                    else if (u <= 0x7FF) {
                        if (outIdx + 1 >= endIdx)
                            break;
                        HEAPU8[outIdx++] = 0xC0 | (u >> 6);
                        HEAPU8[outIdx++] = 0x80 | (u & 63);
                    }
                    else if (u <= 0xFFFF) {
                        if (outIdx + 2 >= endIdx)
                            break;
                        HEAPU8[outIdx++] = 0xE0 | (u >> 12);
                        HEAPU8[outIdx++] = 0x80 | ((u >> 6) & 63);
                        HEAPU8[outIdx++] = 0x80 | (u & 63);
                    }
                    else {
                        if (outIdx + 3 >= endIdx)
                            break;
                        HEAPU8[outIdx++] = 0xF0 | (u >> 18);
                        HEAPU8[outIdx++] = 0x80 | ((u >> 12) & 63);
                        HEAPU8[outIdx++] = 0x80 | ((u >> 6) & 63);
                        HEAPU8[outIdx++] = 0x80 | (u & 63);
                    }
                }
                HEAPU8[outIdx] = 0;
                return outIdx - startIdx;
            },
            UTF16ToString: function (ptr, length) {
                if (!ptr || !length)
                    return '';
                ptr >>>= 0;
                var end = ptr;
                if (length === -1) {
                    var idx = end >> 1;
                    var HEAPU16 = new Uint16Array(wasmMemory.buffer);
                    while (HEAPU16[idx])
                        ++idx;
                    end = idx << 1;
                }
                else {
                    end = ptr + (length >>> 0) * 2;
                }
                length = end - ptr;
                if (length <= 32) {
                    return String.fromCharCode.apply(null, new Uint16Array(wasmMemory.buffer, ptr, length / 2));
                }
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                var HEAPU8 = new Uint8Array(wasmMemory.buffer);
                return emnapiString.utf16Decoder.decode(((typeof SharedArrayBuffer === "function" && HEAPU8.buffer instanceof SharedArrayBuffer) || (Object.prototype.toString.call(HEAPU8.buffer.constructor) === "[object SharedArrayBuffer]")) ? HEAPU8.slice(ptr, end) : HEAPU8.subarray(ptr, end));
            },
            stringToUTF16: function (str, outPtr, maxBytesToWrite) {
                if (maxBytesToWrite === undefined) {
                    maxBytesToWrite = 0x7FFFFFFF;
                }
                if (maxBytesToWrite < 2)
                    return 0;
                maxBytesToWrite -= 2;
                var startPtr = outPtr;
                var numCharsToWrite = (maxBytesToWrite < str.length * 2) ? (maxBytesToWrite / 2) : str.length;
                var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
                for (var i = 0; i < numCharsToWrite; ++i) {
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    var codeUnit = str.charCodeAt(i);
                    HEAP_DATA_VIEW.setInt16(outPtr, codeUnit, true);
                    outPtr += 2;
                }
                HEAP_DATA_VIEW.setInt16(outPtr, 0, true);
                return outPtr - startPtr;
            },
            newString: function (env, str, length, result, stringMaker) {
                if (!env)
                    return 1 /* napi_status.napi_invalid_arg */;
                // @ts-expect-error
                var envObject = emnapiCtx.envStore.get(env);
                envObject.checkGCAccess();
                var autoLength = length === -1;
                var sizelength = length >>> 0;
                if (length !== 0) {
                    if (!str)
                        return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                }
                if (!result)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                if (!(autoLength || (sizelength <= 2147483647)))
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                var strValue = stringMaker(str, autoLength, sizelength);
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                var value = emnapiCtx.addToCurrentScope(strValue).id;
                var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
                HEAP_DATA_VIEW.setInt32(result, value, true);
                return envObject.clearLastError();
            },
            newExternalString: function (env, str, length, finalize_callback, finalize_hint, result, copied, createApi, stringMaker) {
                if (!env)
                    return 1 /* napi_status.napi_invalid_arg */;
                // @ts-expect-error
                var envObject = emnapiCtx.envStore.get(env);
                envObject.checkGCAccess();
                var autoLength = length === -1;
                var sizelength = length >>> 0;
                if (length !== 0) {
                    if (!str)
                        return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                }
                if (!result)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                if (!(autoLength || (sizelength <= 2147483647)))
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                var status = createApi(env, str, length, result);
                if (status === 0 /* napi_status.napi_ok */) {
                    if (copied) {
                        var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
                        HEAP_DATA_VIEW.setInt8(copied, 1, true);
                    }
                    if (finalize_callback) {
                        envObject.callFinalizer(finalize_callback, str, finalize_hint);
                    }
                }
                return status;
            }
        };
        /**
         * @__sig ippp
         */
        function napi_get_array_length(env, value, result) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!envObject.tryCatch.isEmpty())
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            if (!envObject.canCallIntoJs())
                return envObject.setLastError(envObject.moduleApiVersion === 2147483647 /* Version.NAPI_VERSION_EXPERIMENTAL */ ? 23 /* napi_status.napi_cannot_run_js */ : 10 /* napi_status.napi_pending_exception */);
            envObject.clearLastError();
            try {
                if (!value)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                if (!result)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                var handle = emnapiCtx.handleStore.get(value);
                if (!handle.isArray()) {
                    return envObject.setLastError(8 /* napi_status.napi_array_expected */);
                }
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                var v = handle.value.length >>> 0;
                var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
                HEAP_DATA_VIEW.setUint32(result, v, true);
                return envObject.getReturnStatus();
            }
            catch (err) {
                envObject.tryCatch.setError(err);
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            }
        }
        /**
         * @__sig ipppp
         */
        function napi_get_arraybuffer_info(env, arraybuffer, data, byte_length) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!arraybuffer)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            var handle = emnapiCtx.handleStore.get(arraybuffer);
            if (!handle.isArrayBuffer()) {
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            }
            var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
            if (data) {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                var p = emnapiExternalMemory.getArrayBufferPointer(handle.value, true).address;
                HEAP_DATA_VIEW.setInt32(data, p, true);
            }
            if (byte_length) {
                HEAP_DATA_VIEW.setUint32(byte_length, handle.value.byteLength, true);
            }
            return envObject.clearLastError();
        }
        /**
         * @__sig ippp
         */
        function napi_get_prototype(env, value, result) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!envObject.tryCatch.isEmpty())
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            if (!envObject.canCallIntoJs())
                return envObject.setLastError(envObject.moduleApiVersion === 2147483647 /* Version.NAPI_VERSION_EXPERIMENTAL */ ? 23 /* napi_status.napi_cannot_run_js */ : 10 /* napi_status.napi_pending_exception */);
            envObject.clearLastError();
            try {
                if (!value)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                if (!result)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                var handle = emnapiCtx.handleStore.get(value);
                if (handle.value == null) {
                    throw new TypeError('Cannot convert undefined or null to object');
                }
                var v = void 0;
                try {
                    v = handle.isObject() || handle.isFunction() ? handle.value : Object(handle.value);
                }
                catch (_) {
                    return envObject.setLastError(2 /* napi_status.napi_object_expected */);
                }
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                var p = envObject.ensureHandleId(Object.getPrototypeOf(v));
                var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
                HEAP_DATA_VIEW.setInt32(result, p, true);
                return envObject.getReturnStatus();
            }
            catch (err) {
                envObject.tryCatch.setError(err);
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            }
        }
        /**
         * @__sig ippppppp
         */
        function napi_get_typedarray_info(env, typedarray, type, length, data, arraybuffer, byte_offset) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!typedarray)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            var handle = emnapiCtx.handleStore.get(typedarray);
            if (!handle.isTypedArray()) {
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            }
            var v = handle.value;
            var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
            if (type) {
                var t = void 0;
                if (v instanceof Int8Array) {
                    t = 0 /* napi_typedarray_type.napi_int8_array */;
                }
                else if (v instanceof Uint8Array) {
                    t = 1 /* napi_typedarray_type.napi_uint8_array */;
                }
                else if (v instanceof Uint8ClampedArray) {
                    t = 2 /* napi_typedarray_type.napi_uint8_clamped_array */;
                }
                else if (v instanceof Int16Array) {
                    t = 3 /* napi_typedarray_type.napi_int16_array */;
                }
                else if (v instanceof Uint16Array) {
                    t = 4 /* napi_typedarray_type.napi_uint16_array */;
                }
                else if (v instanceof Int32Array) {
                    t = 5 /* napi_typedarray_type.napi_int32_array */;
                }
                else if (v instanceof Uint32Array) {
                    t = 6 /* napi_typedarray_type.napi_uint32_array */;
                }
                else if (v instanceof Float32Array) {
                    t = 7 /* napi_typedarray_type.napi_float32_array */;
                }
                else if (v instanceof Float64Array) {
                    t = 8 /* napi_typedarray_type.napi_float64_array */;
                }
                else if (v instanceof BigInt64Array) {
                    t = 9 /* napi_typedarray_type.napi_bigint64_array */;
                }
                else if (v instanceof BigUint64Array) {
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    t = 10 /* napi_typedarray_type.napi_biguint64_array */;
                }
                else {
                    return envObject.setLastError(9 /* napi_status.napi_generic_failure */);
                }
                HEAP_DATA_VIEW.setInt32(type, t, true);
            }
            if (length) {
                HEAP_DATA_VIEW.setUint32(length, v.length, true);
            }
            var buffer;
            if (data || arraybuffer) {
                buffer = v.buffer;
                if (data) {
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    var p = emnapiExternalMemory.getViewPointer(v, true).address;
                    HEAP_DATA_VIEW.setInt32(data, p, true);
                }
                if (arraybuffer) {
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    var ab = envObject.ensureHandleId(buffer);
                    HEAP_DATA_VIEW.setInt32(arraybuffer, ab, true);
                }
            }
            if (byte_offset) {
                HEAP_DATA_VIEW.setUint32(byte_offset, v.byteOffset, true);
            }
            return envObject.clearLastError();
        }
        /**
         * @__sig ipppp
         */
        function napi_get_buffer_info(env, buffer, data, length) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!buffer)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            var handle = emnapiCtx.handleStore.get(buffer);
            if (!handle.isBuffer())
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            return napi_get_typedarray_info(env, buffer, 0, length, data, 0, 0);
        }
        /**
         * @__sig ipppppp
         */
        function napi_get_dataview_info(env, dataview, byte_length, data, arraybuffer, byte_offset) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!dataview)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            var handle = emnapiCtx.handleStore.get(dataview);
            if (!handle.isDataView()) {
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            }
            var v = handle.value;
            var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
            if (byte_length) {
                HEAP_DATA_VIEW.setUint32(byte_length, v.byteLength, true);
            }
            var buffer;
            if (data || arraybuffer) {
                buffer = v.buffer;
                if (data) {
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    var p = emnapiExternalMemory.getViewPointer(v, true).address;
                    HEAP_DATA_VIEW.setInt32(data, p, true);
                }
                if (arraybuffer) {
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    var ab = envObject.ensureHandleId(buffer);
                    HEAP_DATA_VIEW.setInt32(arraybuffer, ab, true);
                }
            }
            if (byte_offset) {
                HEAP_DATA_VIEW.setUint32(byte_offset, v.byteOffset, true);
            }
            return envObject.clearLastError();
        }
        /**
         * @__sig ippp
         */
        function napi_get_date_value(env, value, result) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var v;
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!envObject.tryCatch.isEmpty())
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            if (!envObject.canCallIntoJs())
                return envObject.setLastError(envObject.moduleApiVersion === 2147483647 /* Version.NAPI_VERSION_EXPERIMENTAL */ ? 23 /* napi_status.napi_cannot_run_js */ : 10 /* napi_status.napi_pending_exception */);
            envObject.clearLastError();
            try {
                if (!value)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                if (!result)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                var handle = emnapiCtx.handleStore.get(value);
                if (!handle.isDate()) {
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                }
                v = handle.value.valueOf();
                var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
                HEAP_DATA_VIEW.setFloat64(result, v, true);
                return envObject.getReturnStatus();
            }
            catch (err) {
                envObject.tryCatch.setError(err);
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            }
        }
        /**
         * @__sig ippp
         */
        function napi_get_value_bool(env, value, result) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!value)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            if (!result)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            var handle = emnapiCtx.handleStore.get(value);
            if (typeof handle.value !== 'boolean') {
                return envObject.setLastError(7 /* napi_status.napi_boolean_expected */);
            }
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var r = handle.value ? 1 : 0;
            var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
            HEAP_DATA_VIEW.setInt8(result, r, true);
            return envObject.clearLastError();
        }
        /**
         * @__sig ippp
         */
        function napi_get_value_double(env, value, result) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!value)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            if (!result)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            var handle = emnapiCtx.handleStore.get(value);
            if (typeof handle.value !== 'number') {
                return envObject.setLastError(6 /* napi_status.napi_number_expected */);
            }
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var r = handle.value;
            var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
            HEAP_DATA_VIEW.setFloat64(result, r, true);
            return envObject.clearLastError();
        }
        /**
         * @__sig ipppp
         */
        function napi_get_value_bigint_int64(env, value, result, lossless) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!emnapiCtx.feature.supportBigInt) {
                return envObject.setLastError(9 /* napi_status.napi_generic_failure */);
            }
            if (!value)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            if (!result)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            if (!lossless)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            var handle = emnapiCtx.handleStore.get(value);
            var numberValue = handle.value;
            if (typeof numberValue !== 'bigint') {
                return envObject.setLastError(6 /* napi_status.napi_number_expected */);
            }
            var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
            if ((numberValue >= (BigInt(-1) * (BigInt(1) << BigInt(63)))) && (numberValue < (BigInt(1) << BigInt(63)))) {
                HEAP_DATA_VIEW.setInt8(lossless, 1, true);
            }
            else {
                HEAP_DATA_VIEW.setInt8(lossless, 0, true);
                numberValue = numberValue & ((BigInt(1) << BigInt(64)) - BigInt(1));
                if (numberValue >= (BigInt(1) << BigInt(63))) {
                    numberValue = numberValue - (BigInt(1) << BigInt(64));
                }
            }
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var low = Number(numberValue & BigInt(0xffffffff));
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var high = Number(numberValue >> BigInt(32));
            HEAP_DATA_VIEW.setInt32(result, low, true);
            HEAP_DATA_VIEW.setInt32(result + 4, high, true);
            return envObject.clearLastError();
        }
        /**
         * @__sig ipppp
         */
        function napi_get_value_bigint_uint64(env, value, result, lossless) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!emnapiCtx.feature.supportBigInt) {
                return envObject.setLastError(9 /* napi_status.napi_generic_failure */);
            }
            if (!value)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            if (!result)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            if (!lossless)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            var handle = emnapiCtx.handleStore.get(value);
            var numberValue = handle.value;
            if (typeof numberValue !== 'bigint') {
                return envObject.setLastError(6 /* napi_status.napi_number_expected */);
            }
            var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
            if ((numberValue >= BigInt(0)) && (numberValue < (BigInt(1) << BigInt(64)))) {
                HEAP_DATA_VIEW.setInt8(lossless, 1, true);
            }
            else {
                HEAP_DATA_VIEW.setInt8(lossless, 0, true);
                numberValue = numberValue & ((BigInt(1) << BigInt(64)) - BigInt(1));
            }
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var low = Number(numberValue & BigInt(0xffffffff));
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var high = Number(numberValue >> BigInt(32));
            HEAP_DATA_VIEW.setUint32(result, low, true);
            HEAP_DATA_VIEW.setUint32(result + 4, high, true);
            return envObject.clearLastError();
        }
        /**
         * @__sig ippppp
         */
        function napi_get_value_bigint_words(env, value, sign_bit, word_count, words) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!emnapiCtx.feature.supportBigInt) {
                return envObject.setLastError(9 /* napi_status.napi_generic_failure */);
            }
            if (!value)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            if (!word_count)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            var handle = emnapiCtx.handleStore.get(value);
            if (!handle.isBigInt()) {
                return envObject.setLastError(17 /* napi_status.napi_bigint_expected */);
            }
            var isMinus = handle.value < BigInt(0);
            var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
            var word_count_int = HEAP_DATA_VIEW.getUint32(word_count, true);
            var wordCount = 0;
            var bigintValue = isMinus ? (handle.value * BigInt(-1)) : handle.value;
            while (bigintValue !== BigInt(0)) {
                wordCount++;
                bigintValue = bigintValue >> BigInt(64);
            }
            bigintValue = isMinus ? (handle.value * BigInt(-1)) : handle.value;
            if (!sign_bit && !words) {
                word_count_int = wordCount;
                HEAP_DATA_VIEW.setUint32(word_count, word_count_int, true);
            }
            else {
                if (!sign_bit)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                if (!words)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                var wordsArr = [];
                while (bigintValue !== BigInt(0)) {
                    var uint64 = bigintValue & ((BigInt(1) << BigInt(64)) - BigInt(1));
                    wordsArr.push(uint64);
                    bigintValue = bigintValue >> BigInt(64);
                }
                var len = Math.min(word_count_int, wordsArr.length);
                for (var i = 0; i < len; i++) {
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    var low = Number(wordsArr[i] & BigInt(0xffffffff));
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    var high = Number(wordsArr[i] >> BigInt(32));
                    HEAP_DATA_VIEW.setUint32(words + i * 8, low, true);
                    HEAP_DATA_VIEW.setUint32(words + i * 8 + 4, high, true);
                }
                HEAP_DATA_VIEW.setInt32(sign_bit, isMinus ? 1 : 0, true);
                HEAP_DATA_VIEW.setUint32(word_count, len, true);
            }
            return envObject.clearLastError();
        }
        /**
         * @__sig ippp
         */
        function napi_get_value_external(env, value, result) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!value)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            if (!result)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            var handle = emnapiCtx.handleStore.get(value);
            if (!handle.isExternal()) {
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            }
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var p = handle.data(envObject);
            var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
            HEAP_DATA_VIEW.setInt32(result, p, true);
            return envObject.clearLastError();
        }
        /**
         * @__sig ippp
         */
        function napi_get_value_int32(env, value, result) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!value)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            if (!result)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            var handle = emnapiCtx.handleStore.get(value);
            if (typeof handle.value !== 'number') {
                return envObject.setLastError(6 /* napi_status.napi_number_expected */);
            }
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var v = new Int32Array([handle.value])[0];
            var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
            HEAP_DATA_VIEW.setInt32(result, v, true);
            return envObject.clearLastError();
        }
        /**
         * @__sig ippp
         */
        function napi_get_value_int64(env, value, result) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!value)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            if (!result)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            var handle = emnapiCtx.handleStore.get(value);
            if (typeof handle.value !== 'number') {
                return envObject.setLastError(6 /* napi_status.napi_number_expected */);
            }
            var numberValue = handle.value;
            var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
            if (numberValue === Number.POSITIVE_INFINITY || numberValue === Number.NEGATIVE_INFINITY || isNaN(numberValue)) {
                HEAP_DATA_VIEW.setInt32(result, 0, true);
                HEAP_DATA_VIEW.setInt32(result + 4, 0, true);
            }
            else if (numberValue < /* INT64_RANGE_NEGATIVE */ -9223372036854776000) {
                HEAP_DATA_VIEW.setInt32(result, 0, true);
                HEAP_DATA_VIEW.setInt32(result + 4, 0x80000000, true);
            }
            else if (numberValue >= /* INT64_RANGE_POSITIVE */ 9223372036854776000) {
                HEAP_DATA_VIEW.setUint32(result, 0xffffffff, true);
                HEAP_DATA_VIEW.setUint32(result + 4, 0x7fffffff, true);
            }
            else {
                $emnapiSetValueI64(result, Math.trunc(numberValue));
            }
            return envObject.clearLastError();
        }
        /**
         * @__sig ippppp
         */
        function napi_get_value_string_latin1(env, value, buf, buf_size, result) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!value)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            buf_size = buf_size >>> 0;
            var handle = emnapiCtx.handleStore.get(value);
            if (typeof handle.value !== 'string') {
                return envObject.setLastError(3 /* napi_status.napi_string_expected */);
            }
            var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
            if (!buf) {
                if (!result)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                HEAP_DATA_VIEW.setUint32(result, handle.value.length, true);
            }
            else if (buf_size !== 0) {
                var copied = 0;
                var v = void 0;
                for (var i = 0; i < buf_size - 1; ++i) {
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    v = handle.value.charCodeAt(i) & 0xff;
                    HEAP_DATA_VIEW.setUint8(buf + i, v, true);
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    copied++;
                }
                HEAP_DATA_VIEW.setUint8(buf + copied, 0, true);
                if (result) {
                    HEAP_DATA_VIEW.setUint32(result, copied, true);
                }
            }
            else if (result) {
                HEAP_DATA_VIEW.setUint32(result, 0, true);
            }
            return envObject.clearLastError();
        }
        /**
         * @__sig ippppp
         */
        function napi_get_value_string_utf8(env, value, buf, buf_size, result) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!value)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            buf_size = buf_size >>> 0;
            var handle = emnapiCtx.handleStore.get(value);
            if (typeof handle.value !== 'string') {
                return envObject.setLastError(3 /* napi_status.napi_string_expected */);
            }
            var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
            if (!buf) {
                if (!result)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                var strLength = emnapiString.lengthBytesUTF8(handle.value);
                HEAP_DATA_VIEW.setUint32(result, strLength, true);
            }
            else if (buf_size !== 0) {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                var copied = emnapiString.stringToUTF8(handle.value, buf, buf_size);
                if (result) {
                    HEAP_DATA_VIEW.setUint32(result, copied, true);
                }
            }
            else if (result) {
                HEAP_DATA_VIEW.setUint32(result, 0, true);
            }
            return envObject.clearLastError();
        }
        /**
         * @__sig ippppp
         */
        function napi_get_value_string_utf16(env, value, buf, buf_size, result) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!value)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            buf_size = buf_size >>> 0;
            var handle = emnapiCtx.handleStore.get(value);
            if (typeof handle.value !== 'string') {
                return envObject.setLastError(3 /* napi_status.napi_string_expected */);
            }
            var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
            if (!buf) {
                if (!result)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                HEAP_DATA_VIEW.setUint32(result, handle.value.length, true);
            }
            else if (buf_size !== 0) {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                var copied = emnapiString.stringToUTF16(handle.value, buf, buf_size * 2);
                if (result) {
                    HEAP_DATA_VIEW.setUint32(result, copied / 2, true);
                }
            }
            else if (result) {
                HEAP_DATA_VIEW.setUint32(result, 0, true);
            }
            return envObject.clearLastError();
        }
        /**
         * @__sig ippp
         */
        function napi_get_value_uint32(env, value, result) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!value)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            if (!result)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            var handle = emnapiCtx.handleStore.get(value);
            if (typeof handle.value !== 'number') {
                return envObject.setLastError(6 /* napi_status.napi_number_expected */);
            }
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var v = new Uint32Array([handle.value])[0];
            var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
            HEAP_DATA_VIEW.setUint32(result, v, true);
            return envObject.clearLastError();
        }
        var convert2cMod = /*#__PURE__*/ Object.freeze({
            __proto__: null,
            napi_get_array_length: napi_get_array_length,
            napi_get_arraybuffer_info: napi_get_arraybuffer_info,
            napi_get_buffer_info: napi_get_buffer_info,
            napi_get_dataview_info: napi_get_dataview_info,
            napi_get_date_value: napi_get_date_value,
            napi_get_prototype: napi_get_prototype,
            napi_get_typedarray_info: napi_get_typedarray_info,
            napi_get_value_bigint_int64: napi_get_value_bigint_int64,
            napi_get_value_bigint_uint64: napi_get_value_bigint_uint64,
            napi_get_value_bigint_words: napi_get_value_bigint_words,
            napi_get_value_bool: napi_get_value_bool,
            napi_get_value_double: napi_get_value_double,
            napi_get_value_external: napi_get_value_external,
            napi_get_value_int32: napi_get_value_int32,
            napi_get_value_int64: napi_get_value_int64,
            napi_get_value_string_latin1: napi_get_value_string_latin1,
            napi_get_value_string_utf16: napi_get_value_string_utf16,
            napi_get_value_string_utf8: napi_get_value_string_utf8,
            napi_get_value_uint32: napi_get_value_uint32
        });
        /**
         * @__sig ipip
         */
        function napi_create_int32(env, value, result) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!result)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var v = emnapiCtx.addToCurrentScope(value).id;
            var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
            HEAP_DATA_VIEW.setInt32(result, v, true);
            return envObject.clearLastError();
        }
        /**
         * @__sig ipip
         */
        function napi_create_uint32(env, value, result) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!result)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var v = emnapiCtx.addToCurrentScope(value >>> 0).id;
            var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
            HEAP_DATA_VIEW.setInt32(result, v, true);
            return envObject.clearLastError();
        }
        /**
         * @__sig ipjp
         */
        function napi_create_int64(env, low, high, result) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            var value;
            if (!high)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            value = Number(low);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var v1 = emnapiCtx.addToCurrentScope(value).id;
            var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
            HEAP_DATA_VIEW.setInt32(high, v1, true);
            return envObject.clearLastError();
        }
        /**
         * @__sig ipdp
         */
        function napi_create_double(env, value, result) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!result)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var v = emnapiCtx.addToCurrentScope(value).id;
            var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
            HEAP_DATA_VIEW.setInt32(result, v, true);
            return envObject.clearLastError();
        }
        /**
         * @__sig ipppp
         */
        function napi_create_string_latin1(env, str, length, result) {
            return emnapiString.newString(env, str, length, result, function (str, autoLength, sizeLength) {
                var latin1String = '';
                var len = 0;
                var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
                if (autoLength) {
                    while (true) {
                        var ch = HEAP_DATA_VIEW.getUint8(str, true);
                        if (!ch)
                            break;
                        latin1String += String.fromCharCode(ch);
                        str++;
                    }
                }
                else {
                    while (len < sizeLength) {
                        var ch = HEAP_DATA_VIEW.getUint8(str, true);
                        if (!ch)
                            break;
                        latin1String += String.fromCharCode(ch);
                        len++;
                        str++;
                    }
                }
                return latin1String;
            });
        }
        /**
         * @__sig ipppp
         */
        function napi_create_string_utf16(env, str, length, result) {
            return emnapiString.newString(env, str, length, result, function (str) {
                return emnapiString.UTF16ToString(str, length);
            });
        }
        /**
         * @__sig ipppp
         */
        function napi_create_string_utf8(env, str, length, result) {
            return emnapiString.newString(env, str, length, result, function (str) {
                return emnapiString.UTF8ToString(str, length);
            });
        }
        /**
         * @__sig ippppppp
         */
        function node_api_create_external_string_latin1(env, str, length, finalize_callback, finalize_hint, result, copied) {
            return emnapiString.newExternalString(env, str, length, finalize_callback, finalize_hint, result, copied, napi_create_string_latin1, undefined);
        }
        /**
         * @__sig ippppppp
         */
        function node_api_create_external_string_utf16(env, str, length, finalize_callback, finalize_hint, result, copied) {
            return emnapiString.newExternalString(env, str, length, finalize_callback, finalize_hint, result, copied, napi_create_string_utf16, undefined);
        }
        /**
         * @__sig ipppp
         */
        function node_api_create_property_key_utf16(env, str, length, result) {
            return napi_create_string_utf16(env, str, length, result);
        }
        /**
         * @__sig ipjp
         */
        function napi_create_bigint_int64(env, low, high, result) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!emnapiCtx.feature.supportBigInt) {
                return envObject.setLastError(9 /* napi_status.napi_generic_failure */);
            }
            var value;
            if (!high)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            value = low;
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var v1 = emnapiCtx.addToCurrentScope(value).id;
            var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
            HEAP_DATA_VIEW.setInt32(high, v1, true);
            return envObject.clearLastError();
        }
        /**
         * @__sig ipjp
         */
        function napi_create_bigint_uint64(env, low, high, result) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!emnapiCtx.feature.supportBigInt) {
                return envObject.setLastError(9 /* napi_status.napi_generic_failure */);
            }
            var value;
            if (!high)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            value = low & ((BigInt(1) << BigInt(64)) - BigInt(1));
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var v1 = emnapiCtx.addToCurrentScope(value).id;
            var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
            HEAP_DATA_VIEW.setInt32(high, v1, true);
            return envObject.clearLastError();
        }
        /**
         * @__sig ipippp
         */
        function napi_create_bigint_words(env, sign_bit, word_count, words, result) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var v, i;
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!envObject.tryCatch.isEmpty())
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            if (!envObject.canCallIntoJs())
                return envObject.setLastError(envObject.moduleApiVersion === 2147483647 /* Version.NAPI_VERSION_EXPERIMENTAL */ ? 23 /* napi_status.napi_cannot_run_js */ : 10 /* napi_status.napi_pending_exception */);
            envObject.clearLastError();
            try {
                if (!emnapiCtx.feature.supportBigInt) {
                    return envObject.setLastError(9 /* napi_status.napi_generic_failure */);
                }
                if (!result)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                word_count = word_count >>> 0;
                if (word_count > 2147483647) {
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                }
                if (word_count > (1024 * 1024 / (4 * 8) / 2)) {
                    throw new RangeError('Maximum BigInt size exceeded');
                }
                var value = BigInt(0);
                var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
                for (i = 0; i < word_count; i++) {
                    var low = HEAP_DATA_VIEW.getUint32(words + i * 8, true);
                    var high = HEAP_DATA_VIEW.getUint32(words + i * 8 + 4, true);
                    var wordi = BigInt(low) | (BigInt(high) << BigInt(32));
                    value += wordi << BigInt(64 * i);
                }
                value *= ((BigInt(sign_bit) % BigInt(2) === BigInt(0)) ? BigInt(1) : BigInt(-1));
                v = emnapiCtx.addToCurrentScope(value).id;
                HEAP_DATA_VIEW.setInt32(result, v, true);
                return envObject.getReturnStatus();
            }
            catch (err) {
                envObject.tryCatch.setError(err);
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            }
        }
        var convert2napiMod = /*#__PURE__*/ Object.freeze({
            __proto__: null,
            napi_create_bigint_int64: napi_create_bigint_int64,
            napi_create_bigint_uint64: napi_create_bigint_uint64,
            napi_create_bigint_words: napi_create_bigint_words,
            napi_create_double: napi_create_double,
            napi_create_int32: napi_create_int32,
            napi_create_int64: napi_create_int64,
            napi_create_string_latin1: napi_create_string_latin1,
            napi_create_string_utf16: napi_create_string_utf16,
            napi_create_string_utf8: napi_create_string_utf8,
            napi_create_uint32: napi_create_uint32,
            node_api_create_external_string_latin1: node_api_create_external_string_latin1,
            node_api_create_external_string_utf16: node_api_create_external_string_utf16,
            node_api_create_property_key_utf16: node_api_create_property_key_utf16
        });
        function emnapiCreateFunction(envObject, utf8name, length, cb, data) {
            var functionName = (!utf8name || !length) ? '' : (emnapiString.UTF8ToString(utf8name, length));
            var f;
            var makeFunction = function () {
                return function () {
                    var cbinfo = emnapiCtx.cbinfoStack.push(this, data, arguments, f);
                    var scope = emnapiCtx.openScope(envObject);
                    try {
                        return envObject.callIntoModule(function (envObject) {
                            var napiValue = (wasmTable.get(cb))(envObject.id, cbinfo);
                            return (!napiValue) ? undefined : emnapiCtx.handleStore.get(napiValue).value;
                        });
                    }
                    finally {
                        emnapiCtx.cbinfoStack.pop();
                        emnapiCtx.closeScope(envObject, scope);
                    }
                };
            };
            if (functionName === '') {
                f = makeFunction();
                return { status: 0 /* napi_status.napi_ok */, f: f };
            }
            if (!(/^[_$a-zA-Z][_$a-zA-Z0-9]*$/.test(functionName))) {
                return { status: 1 /* napi_status.napi_invalid_arg */, f: undefined };
            }
            if (emnapiCtx.feature.supportNewFunction) {
                var _ = makeFunction();
                try {
                    f = (new Function('_', 'return function ' + functionName + '(){' +
                        '"use strict";' +
                        'return _.apply(this,arguments);' +
                        '};'))(_);
                }
                catch (_err) {
                    f = makeFunction();
                    if (emnapiCtx.feature.canSetFunctionName)
                        Object.defineProperty(f, 'name', { value: functionName });
                }
            }
            else {
                f = makeFunction();
                if (emnapiCtx.feature.canSetFunctionName)
                    Object.defineProperty(f, 'name', { value: functionName });
            }
            return { status: 0 /* napi_status.napi_ok */, f: f };
        }
        function emnapiDefineProperty(envObject, obj, propertyName, method, getter, setter, value, attributes, data) {
            if (getter || setter) {
                var localGetter = void 0;
                var localSetter = void 0;
                if (getter) {
                    localGetter = emnapiCreateFunction(envObject, 0, 0, getter, data).f;
                }
                if (setter) {
                    localSetter = emnapiCreateFunction(envObject, 0, 0, setter, data).f;
                }
                var desc = {
                    configurable: (attributes & 4 /* napi_property_attributes.napi_configurable */) !== 0,
                    enumerable: (attributes & 2 /* napi_property_attributes.napi_enumerable */) !== 0,
                    get: localGetter,
                    set: localSetter
                };
                Object.defineProperty(obj, propertyName, desc);
            }
            else if (method) {
                var localMethod = emnapiCreateFunction(envObject, 0, 0, method, data).f;
                var desc = {
                    configurable: (attributes & 4 /* napi_property_attributes.napi_configurable */) !== 0,
                    enumerable: (attributes & 2 /* napi_property_attributes.napi_enumerable */) !== 0,
                    writable: (attributes & 1 /* napi_property_attributes.napi_writable */) !== 0,
                    value: localMethod
                };
                Object.defineProperty(obj, propertyName, desc);
            }
            else {
                var desc = {
                    configurable: (attributes & 4 /* napi_property_attributes.napi_configurable */) !== 0,
                    enumerable: (attributes & 2 /* napi_property_attributes.napi_enumerable */) !== 0,
                    writable: (attributes & 1 /* napi_property_attributes.napi_writable */) !== 0,
                    value: emnapiCtx.handleStore.get(value).value
                };
                Object.defineProperty(obj, propertyName, desc);
            }
        }
        function emnapiGetHandle(js_object) {
            var handle = emnapiCtx.handleStore.get(js_object);
            if (!(handle.isObject() || handle.isFunction())) {
                return { status: 1 /* napi_status.napi_invalid_arg */ };
            }
            if (typeof emnapiExternalMemory !== 'undefined' && ArrayBuffer.isView(handle.value)) {
                if (emnapiExternalMemory.wasmMemoryViewTable.has(handle.value)) {
                    handle = emnapiCtx.addToCurrentScope(emnapiExternalMemory.wasmMemoryViewTable.get(handle.value));
                }
            }
            return { status: 0 /* napi_status.napi_ok */, handle: handle };
        }
        function emnapiWrap(env, js_object, native_object, finalize_cb, finalize_hint, result) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var referenceId;
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!envObject.tryCatch.isEmpty())
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            if (!envObject.canCallIntoJs())
                return envObject.setLastError(envObject.moduleApiVersion === 2147483647 /* Version.NAPI_VERSION_EXPERIMENTAL */ ? 23 /* napi_status.napi_cannot_run_js */ : 10 /* napi_status.napi_pending_exception */);
            envObject.clearLastError();
            try {
                if (!emnapiCtx.feature.supportFinalizer) {
                    if (finalize_cb) {
                        throw emnapiCtx.createNotSupportWeakRefError('napi_wrap', 'Parameter "finalize_cb" must be 0(NULL)');
                    }
                    if (result) {
                        throw emnapiCtx.createNotSupportWeakRefError('napi_wrap', 'Parameter "result" must be 0(NULL)');
                    }
                }
                if (!js_object)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                var handleResult = emnapiGetHandle(js_object);
                if (handleResult.status !== 0 /* napi_status.napi_ok */) {
                    return envObject.setLastError(handleResult.status);
                }
                var handle = handleResult.handle;
                if (envObject.getObjectBinding(handle.value).wrapped !== 0) {
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                }
                var reference = void 0;
                if (result) {
                    if (!finalize_cb)
                        return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                    reference = emnapiCtx.createReference(envObject, handle.id, 0, 1 /* Ownership.kUserland */, finalize_cb, native_object, finalize_hint);
                    referenceId = reference.id;
                    var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
                    HEAP_DATA_VIEW.setInt32(result, referenceId, true);
                }
                else {
                    reference = emnapiCtx.createReference(envObject, handle.id, 0, 0 /* Ownership.kRuntime */, finalize_cb, native_object, !finalize_cb ? finalize_cb : finalize_hint);
                }
                envObject.getObjectBinding(handle.value).wrapped = reference.id;
                return envObject.getReturnStatus();
            }
            catch (err) {
                envObject.tryCatch.setError(err);
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            }
        }
        function emnapiUnwrap(env, js_object, result, action) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var data;
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!envObject.tryCatch.isEmpty())
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            if (!envObject.canCallIntoJs())
                return envObject.setLastError(envObject.moduleApiVersion === 2147483647 /* Version.NAPI_VERSION_EXPERIMENTAL */ ? 23 /* napi_status.napi_cannot_run_js */ : 10 /* napi_status.napi_pending_exception */);
            envObject.clearLastError();
            try {
                if (!js_object)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                if (action === 0 /* UnwrapAction.KeepWrap */) {
                    if (!result)
                        return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                }
                var value = emnapiCtx.handleStore.get(js_object);
                if (!(value.isObject() || value.isFunction())) {
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                }
                var binding = envObject.getObjectBinding(value.value);
                var referenceId = binding.wrapped;
                var ref = emnapiCtx.refStore.get(referenceId);
                if (!ref)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                if (result) {
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    data = ref.data();
                    var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
                    HEAP_DATA_VIEW.setInt32(result, data, true);
                }
                if (action === 1 /* UnwrapAction.RemoveWrap */) {
                    binding.wrapped = 0;
                    if (ref.ownership() === 1 /* Ownership.kUserland */) {
                        // When the wrap is been removed, the finalizer should be reset.
                        ref.resetFinalizer();
                    }
                    else {
                        ref.dispose();
                    }
                }
                return envObject.getReturnStatus();
            }
            catch (err) {
                envObject.tryCatch.setError(err);
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            }
        }
        /**
         * @__sig ipppppppp
         */
        function napi_define_class(env, utf8name, length, constructor, callback_data, property_count, properties, result) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var propPtr, valueHandleId, attributes;
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!envObject.tryCatch.isEmpty())
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            if (!envObject.canCallIntoJs())
                return envObject.setLastError(envObject.moduleApiVersion === 2147483647 /* Version.NAPI_VERSION_EXPERIMENTAL */ ? 23 /* napi_status.napi_cannot_run_js */ : 10 /* napi_status.napi_pending_exception */);
            envObject.clearLastError();
            try {
                if (!result)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                if (!constructor)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                property_count = property_count >>> 0;
                if (property_count > 0) {
                    if (!properties)
                        return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                }
                if ((length < -1) || (length > 2147483647) || (!utf8name)) {
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                }
                var fresult = emnapiCreateFunction(envObject, utf8name, length, constructor, callback_data);
                if (fresult.status !== 0 /* napi_status.napi_ok */)
                    return envObject.setLastError(fresult.status);
                var F = fresult.f;
                var propertyName = void 0;
                var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
                for (var i = 0; i < property_count; i++) {
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    propPtr = properties + (i * (4 * 8));
                    var utf8Name = HEAP_DATA_VIEW.getInt32(propPtr, true);
                    var name_1 = HEAP_DATA_VIEW.getInt32(propPtr + 4, true);
                    var method = HEAP_DATA_VIEW.getInt32(propPtr + 8, true);
                    var getter = HEAP_DATA_VIEW.getInt32(propPtr + 12, true);
                    var setter = HEAP_DATA_VIEW.getInt32(propPtr + 16, true);
                    var value = HEAP_DATA_VIEW.getInt32(propPtr + 20, true);
                    attributes = HEAP_DATA_VIEW.getInt32(propPtr + 24, true);
                    var data = HEAP_DATA_VIEW.getInt32(propPtr + 28, true);
                    if (utf8Name) {
                        propertyName = emnapiString.UTF8ToString(utf8Name, -1);
                    }
                    else {
                        if (!name_1) {
                            return envObject.setLastError(4 /* napi_status.napi_name_expected */);
                        }
                        propertyName = emnapiCtx.handleStore.get(name_1).value;
                        if (typeof propertyName !== 'string' && typeof propertyName !== 'symbol') {
                            return envObject.setLastError(4 /* napi_status.napi_name_expected */);
                        }
                    }
                    if ((attributes & 1024 /* napi_property_attributes.napi_static */) !== 0) {
                        emnapiDefineProperty(envObject, F, propertyName, method, getter, setter, value, attributes, data);
                        continue;
                    }
                    emnapiDefineProperty(envObject, F.prototype, propertyName, method, getter, setter, value, attributes, data);
                }
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                var valueHandle = emnapiCtx.addToCurrentScope(F);
                valueHandleId = valueHandle.id;
                HEAP_DATA_VIEW.setInt32(result, valueHandleId, true);
                return envObject.getReturnStatus();
            }
            catch (err) {
                envObject.tryCatch.setError(err);
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            }
        }
        /**
         * @__sig ipppppp
         */
        function napi_wrap(env, js_object, native_object, finalize_cb, finalize_hint, result) {
            return emnapiWrap(env, js_object, native_object, finalize_cb, finalize_hint, result);
        }
        /**
         * @__sig ippp
         */
        function napi_unwrap(env, js_object, result) {
            return emnapiUnwrap(env, js_object, result, 0 /* UnwrapAction.KeepWrap */);
        }
        /**
         * @__sig ippp
         */
        function napi_remove_wrap(env, js_object, result) {
            return emnapiUnwrap(env, js_object, result, 1 /* UnwrapAction.RemoveWrap */);
        }
        /**
         * @__sig ippp
         */
        function napi_type_tag_object(env, object, type_tag) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!envObject.tryCatch.isEmpty())
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            if (!envObject.canCallIntoJs())
                return envObject.setLastError(envObject.moduleApiVersion === 2147483647 /* Version.NAPI_VERSION_EXPERIMENTAL */ ? 23 /* napi_status.napi_cannot_run_js */ : 10 /* napi_status.napi_pending_exception */);
            envObject.clearLastError();
            try {
                if (!object) {
                    return envObject.setLastError(envObject.tryCatch.hasCaught() ? 10 /* napi_status.napi_pending_exception */ : 1 /* napi_status.napi_invalid_arg */);
                }
                var value = emnapiCtx.handleStore.get(object);
                if (!(value.isObject() || value.isFunction())) {
                    return envObject.setLastError(envObject.tryCatch.hasCaught() ? 10 /* napi_status.napi_pending_exception */ : 2 /* napi_status.napi_object_expected */);
                }
                if (!type_tag) {
                    return envObject.setLastError(envObject.tryCatch.hasCaught() ? 10 /* napi_status.napi_pending_exception */ : 1 /* napi_status.napi_invalid_arg */);
                }
                var binding = envObject.getObjectBinding(value.value);
                if (binding.tag !== null) {
                    return envObject.setLastError(envObject.tryCatch.hasCaught() ? 10 /* napi_status.napi_pending_exception */ : 1 /* napi_status.napi_invalid_arg */);
                }
                var tag = new Uint8Array(16);
                tag.set(new Uint8Array(wasmMemory.buffer, type_tag, 16));
                binding.tag = new Uint32Array(tag.buffer);
                return envObject.getReturnStatus();
            }
            catch (err) {
                envObject.tryCatch.setError(err);
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            }
        }
        /**
         * @__sig ipppp
         */
        function napi_check_object_type_tag(env, object, type_tag, result) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars, one-var
            var ret = true;
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!envObject.tryCatch.isEmpty())
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            if (!envObject.canCallIntoJs())
                return envObject.setLastError(envObject.moduleApiVersion === 2147483647 /* Version.NAPI_VERSION_EXPERIMENTAL */ ? 23 /* napi_status.napi_cannot_run_js */ : 10 /* napi_status.napi_pending_exception */);
            envObject.clearLastError();
            try {
                if (!object) {
                    return envObject.setLastError(envObject.tryCatch.hasCaught() ? 10 /* napi_status.napi_pending_exception */ : 1 /* napi_status.napi_invalid_arg */);
                }
                var value = emnapiCtx.handleStore.get(object);
                if (!(value.isObject() || value.isFunction())) {
                    return envObject.setLastError(envObject.tryCatch.hasCaught() ? 10 /* napi_status.napi_pending_exception */ : 2 /* napi_status.napi_object_expected */);
                }
                if (!type_tag) {
                    return envObject.setLastError(envObject.tryCatch.hasCaught() ? 10 /* napi_status.napi_pending_exception */ : 1 /* napi_status.napi_invalid_arg */);
                }
                if (!result) {
                    return envObject.setLastError(envObject.tryCatch.hasCaught() ? 10 /* napi_status.napi_pending_exception */ : 1 /* napi_status.napi_invalid_arg */);
                }
                var binding = envObject.getObjectBinding(value.value);
                if (binding.tag !== null) {
                    var tag = binding.tag;
                    var typeTag = new Uint32Array(wasmMemory.buffer, type_tag, 4);
                    ret = (tag[0] === typeTag[0] &&
                        tag[1] === typeTag[1] &&
                        tag[2] === typeTag[2] &&
                        tag[3] === typeTag[3]);
                }
                else {
                    ret = false;
                }
                var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
                HEAP_DATA_VIEW.setInt8(result, ret ? 1 : 0, true);
                return envObject.getReturnStatus();
            }
            catch (err) {
                envObject.tryCatch.setError(err);
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            }
        }
        /**
         * @__sig ipppppp
         */
        function napi_add_finalizer(env, js_object, finalize_data, finalize_cb, finalize_hint, result) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!emnapiCtx.feature.supportFinalizer) {
                return envObject.setLastError(9 /* napi_status.napi_generic_failure */);
            }
            if (!js_object)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            if (!finalize_cb)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            var handleResult = emnapiGetHandle(js_object);
            if (handleResult.status !== 0 /* napi_status.napi_ok */) {
                return envObject.setLastError(handleResult.status);
            }
            var handle = handleResult.handle;
            var ownership = !result ? 0 /* Ownership.kRuntime */ : 1 /* Ownership.kUserland */;
            var reference = emnapiCtx.createReference(envObject, handle.id, 0, ownership, finalize_cb, finalize_data, finalize_hint);
            if (result) {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                var referenceId = reference.id;
                var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
                HEAP_DATA_VIEW.setInt32(result, referenceId, true);
            }
            return envObject.clearLastError();
        }
        /**
         * @__sig ipppp
         */
        function node_api_post_finalizer(env, finalize_cb, finalize_data, finalize_hint) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            var envObject = emnapiCtx.envStore.get(env);
            envObject.enqueueFinalizer(emnapiCtx.createTrackedFinalizer(envObject, finalize_cb, finalize_data, finalize_hint));
            return envObject.clearLastError();
        }
        var wrapMod = /*#__PURE__*/ Object.freeze({
            __proto__: null,
            napi_add_finalizer: napi_add_finalizer,
            napi_check_object_type_tag: napi_check_object_type_tag,
            napi_define_class: napi_define_class,
            napi_remove_wrap: napi_remove_wrap,
            napi_type_tag_object: napi_type_tag_object,
            napi_unwrap: napi_unwrap,
            napi_wrap: napi_wrap,
            node_api_post_finalizer: node_api_post_finalizer
        });
        /**
         * @__sig ipippppp
         */
        function emnapi_create_memory_view(env, typedarray_type, external_data, byte_length, finalize_cb, finalize_hint, result) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var value;
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!envObject.tryCatch.isEmpty())
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            if (!envObject.canCallIntoJs())
                return envObject.setLastError(envObject.moduleApiVersion === 2147483647 /* Version.NAPI_VERSION_EXPERIMENTAL */ ? 23 /* napi_status.napi_cannot_run_js */ : 10 /* napi_status.napi_pending_exception */);
            envObject.clearLastError();
            try {
                if (!result)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                byte_length = byte_length >>> 0;
                if (!external_data) {
                    byte_length = 0;
                }
                if (byte_length > 2147483647) {
                    throw new RangeError('Cannot create a memory view larger than 2147483647 bytes');
                }
                if ((external_data + byte_length) > wasmMemory.buffer.byteLength) {
                    throw new RangeError('Memory out of range');
                }
                if (!emnapiCtx.feature.supportFinalizer && finalize_cb) {
                    throw emnapiCtx.createNotSupportWeakRefError('emnapi_create_memory_view', 'Parameter "finalize_cb" must be 0(NULL)');
                }
                var viewDescriptor = void 0;
                switch (typedarray_type) {
                    case 0 /* emnapi_memory_view_type.emnapi_int8_array */:
                        viewDescriptor = { Ctor: Int8Array, address: external_data, length: byte_length, ownership: 1 /* Ownership.kUserland */, runtimeAllocated: 0 };
                        break;
                    case 1 /* emnapi_memory_view_type.emnapi_uint8_array */:
                        viewDescriptor = { Ctor: Uint8Array, address: external_data, length: byte_length, ownership: 1 /* Ownership.kUserland */, runtimeAllocated: 0 };
                        break;
                    case 2 /* emnapi_memory_view_type.emnapi_uint8_clamped_array */:
                        viewDescriptor = { Ctor: Uint8ClampedArray, address: external_data, length: byte_length, ownership: 1 /* Ownership.kUserland */, runtimeAllocated: 0 };
                        break;
                    case 3 /* emnapi_memory_view_type.emnapi_int16_array */:
                        viewDescriptor = { Ctor: Int16Array, address: external_data, length: byte_length >> 1, ownership: 1 /* Ownership.kUserland */, runtimeAllocated: 0 };
                        break;
                    case 4 /* emnapi_memory_view_type.emnapi_uint16_array */:
                        viewDescriptor = { Ctor: Uint16Array, address: external_data, length: byte_length >> 1, ownership: 1 /* Ownership.kUserland */, runtimeAllocated: 0 };
                        break;
                    case 5 /* emnapi_memory_view_type.emnapi_int32_array */:
                        viewDescriptor = { Ctor: Int32Array, address: external_data, length: byte_length >> 2, ownership: 1 /* Ownership.kUserland */, runtimeAllocated: 0 };
                        break;
                    case 6 /* emnapi_memory_view_type.emnapi_uint32_array */:
                        viewDescriptor = { Ctor: Uint32Array, address: external_data, length: byte_length >> 2, ownership: 1 /* Ownership.kUserland */, runtimeAllocated: 0 };
                        break;
                    case 7 /* emnapi_memory_view_type.emnapi_float32_array */:
                        viewDescriptor = { Ctor: Float32Array, address: external_data, length: byte_length >> 2, ownership: 1 /* Ownership.kUserland */, runtimeAllocated: 0 };
                        break;
                    case 8 /* emnapi_memory_view_type.emnapi_float64_array */:
                        viewDescriptor = { Ctor: Float64Array, address: external_data, length: byte_length >> 3, ownership: 1 /* Ownership.kUserland */, runtimeAllocated: 0 };
                        break;
                    case 9 /* emnapi_memory_view_type.emnapi_bigint64_array */:
                        viewDescriptor = { Ctor: BigInt64Array, address: external_data, length: byte_length >> 3, ownership: 1 /* Ownership.kUserland */, runtimeAllocated: 0 };
                        break;
                    case 10 /* emnapi_memory_view_type.emnapi_biguint64_array */:
                        viewDescriptor = { Ctor: BigUint64Array, address: external_data, length: byte_length >> 3, ownership: 1 /* Ownership.kUserland */, runtimeAllocated: 0 };
                        break;
                    case -1 /* emnapi_memory_view_type.emnapi_data_view */:
                        viewDescriptor = { Ctor: DataView, address: external_data, length: byte_length, ownership: 1 /* Ownership.kUserland */, runtimeAllocated: 0 };
                        break;
                    case -2 /* emnapi_memory_view_type.emnapi_buffer */: {
                        if (!emnapiCtx.feature.Buffer) {
                            throw emnapiCtx.createNotSupportBufferError('emnapi_create_memory_view', '');
                        }
                        viewDescriptor = { Ctor: emnapiCtx.feature.Buffer, address: external_data, length: byte_length, ownership: 1 /* Ownership.kUserland */, runtimeAllocated: 0 };
                        break;
                    }
                    default: return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                }
                var Ctor = viewDescriptor.Ctor;
                var typedArray = typedarray_type === -2 /* emnapi_memory_view_type.emnapi_buffer */
                    ? emnapiCtx.feature.Buffer.from(wasmMemory.buffer, viewDescriptor.address, viewDescriptor.length)
                    : new Ctor(wasmMemory.buffer, viewDescriptor.address, viewDescriptor.length);
                var handle = emnapiCtx.addToCurrentScope(typedArray);
                emnapiExternalMemory.wasmMemoryViewTable.set(typedArray, viewDescriptor);
                if (finalize_cb) {
                    var status_1 = napi_add_finalizer(env, handle.id, external_data, finalize_cb, finalize_hint, /* NULL */ 0);
                    if (status_1 === 10 /* napi_status.napi_pending_exception */) {
                        var err = envObject.tryCatch.extractException();
                        envObject.clearLastError();
                        throw err;
                    }
                    else if (status_1 !== 0 /* napi_status.napi_ok */) {
                        return envObject.setLastError(status_1);
                    }
                }
                value = handle.id;
                var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
                HEAP_DATA_VIEW.setInt32(result, value, true);
                return envObject.getReturnStatus();
            }
            catch (err) {
                envObject.tryCatch.setError(err);
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            }
        }
        /**
         * @__sig i
         */
        function emnapi_is_support_weakref() {
            return emnapiCtx.feature.supportFinalizer ? 1 : 0;
        }
        /**
         * @__sig i
         */
        function emnapi_is_support_bigint() {
            return emnapiCtx.feature.supportBigInt ? 1 : 0;
        }
        /**
         * @__sig i
         */
        function emnapi_is_node_binding_available() {
            return emnapiNodeBinding ? 1 : 0;
        }
        function $emnapiSyncMemory(js_to_wasm, arrayBufferOrView, offset, len) {
            offset = offset !== null && offset !== void 0 ? offset : 0;
            offset = offset >>> 0;
            var view;
            if (arrayBufferOrView instanceof ArrayBuffer) {
                var pointer = emnapiExternalMemory.getArrayBufferPointer(arrayBufferOrView, false).address;
                if (!pointer)
                    throw new Error('Unknown ArrayBuffer address');
                if (typeof len !== 'number' || len === -1) {
                    len = arrayBufferOrView.byteLength - offset;
                }
                len = len >>> 0;
                if (len === 0)
                    return arrayBufferOrView;
                view = new Uint8Array(arrayBufferOrView, offset, len);
                var wasmMemoryU8 = new Uint8Array(wasmMemory.buffer);
                if (!js_to_wasm) {
                    view.set(wasmMemoryU8.subarray(pointer, pointer + len));
                }
                else {
                    wasmMemoryU8.set(view, pointer);
                }
                return arrayBufferOrView;
            }
            if (ArrayBuffer.isView(arrayBufferOrView)) {
                var viewPointerInfo = emnapiExternalMemory.getViewPointer(arrayBufferOrView, false);
                var latestView = viewPointerInfo.view;
                var pointer = viewPointerInfo.address;
                if (!pointer)
                    throw new Error('Unknown ArrayBuffer address');
                if (typeof len !== 'number' || len === -1) {
                    len = latestView.byteLength - offset;
                }
                len = len >>> 0;
                if (len === 0)
                    return latestView;
                view = new Uint8Array(latestView.buffer, latestView.byteOffset + offset, len);
                var wasmMemoryU8 = new Uint8Array(wasmMemory.buffer);
                if (!js_to_wasm) {
                    view.set(wasmMemoryU8.subarray(pointer, pointer + len));
                }
                else {
                    wasmMemoryU8.set(view, pointer);
                }
                return latestView;
            }
            throw new TypeError('emnapiSyncMemory expect ArrayBuffer or ArrayBufferView as first parameter');
        }
        /**
         * @__sig ipippp
         */
        function emnapi_sync_memory(env, js_to_wasm, arraybuffer_or_view, offset, len) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var v;
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!envObject.tryCatch.isEmpty())
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            if (!envObject.canCallIntoJs())
                return envObject.setLastError(envObject.moduleApiVersion === 2147483647 /* Version.NAPI_VERSION_EXPERIMENTAL */ ? 23 /* napi_status.napi_cannot_run_js */ : 10 /* napi_status.napi_pending_exception */);
            envObject.clearLastError();
            try {
                if (!arraybuffer_or_view)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
                var handleId = HEAP_DATA_VIEW.getInt32(arraybuffer_or_view, true);
                var handle = envObject.ctx.handleStore.get(handleId);
                if (!handle.isArrayBuffer() && !handle.isTypedArray() && !handle.isDataView()) {
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                }
                var ret = $emnapiSyncMemory(Boolean(js_to_wasm), handle.value, offset, len);
                if (handle.value !== ret) {
                    v = envObject.ensureHandleId(ret);
                    HEAP_DATA_VIEW.setInt32(arraybuffer_or_view, v, true);
                }
                return envObject.getReturnStatus();
            }
            catch (err) {
                envObject.tryCatch.setError(err);
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            }
        }
        function $emnapiGetMemoryAddress(arrayBufferOrView) {
            var isArrayBuffer = arrayBufferOrView instanceof ArrayBuffer;
            var isDataView = arrayBufferOrView instanceof DataView;
            var isTypedArray = ArrayBuffer.isView(arrayBufferOrView) && !isDataView;
            if (!isArrayBuffer && !isTypedArray && !isDataView) {
                throw new TypeError('emnapiGetMemoryAddress expect ArrayBuffer or ArrayBufferView as first parameter');
            }
            var info;
            if (isArrayBuffer) {
                info = emnapiExternalMemory.getArrayBufferPointer(arrayBufferOrView, false);
            }
            else {
                info = emnapiExternalMemory.getViewPointer(arrayBufferOrView, false);
            }
            return {
                address: info.address,
                ownership: info.ownership,
                runtimeAllocated: info.runtimeAllocated
            };
        }
        /**
         * @__sig ipppp
         */
        function emnapi_get_memory_address(env, arraybuffer_or_view, address, ownership, runtime_allocated) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var p, runtimeAllocated, ownershipOut;
            var info;
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!envObject.tryCatch.isEmpty())
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            if (!envObject.canCallIntoJs())
                return envObject.setLastError(envObject.moduleApiVersion === 2147483647 /* Version.NAPI_VERSION_EXPERIMENTAL */ ? 23 /* napi_status.napi_cannot_run_js */ : 10 /* napi_status.napi_pending_exception */);
            envObject.clearLastError();
            try {
                if (!arraybuffer_or_view)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                if (!address && !ownership && !runtime_allocated) {
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                }
                var handle = envObject.ctx.handleStore.get(arraybuffer_or_view);
                info = $emnapiGetMemoryAddress(handle.value);
                p = info.address;
                var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
                if (address) {
                    HEAP_DATA_VIEW.setInt32(address, p, true);
                }
                if (ownership) {
                    ownershipOut = info.ownership;
                    HEAP_DATA_VIEW.setInt32(ownership, ownershipOut, true);
                }
                if (runtime_allocated) {
                    runtimeAllocated = info.runtimeAllocated;
                    HEAP_DATA_VIEW.setInt8(runtime_allocated, runtimeAllocated, true);
                }
                return envObject.getReturnStatus();
            }
            catch (err) {
                envObject.tryCatch.setError(err);
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            }
        }
        /**
         * @__sig ipp
         */
        function emnapi_get_runtime_version(env, version) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            var envObject = emnapiCtx.envStore.get(env);
            if (!version)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            var runtimeVersion;
            try {
                runtimeVersion = emnapiCtx.getRuntimeVersions().version;
            }
            catch (_) {
                return envObject.setLastError(9 /* napi_status.napi_generic_failure */);
            }
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var versions = runtimeVersion.split('.')
                .map(function (n) { return Number(n); });
            var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
            HEAP_DATA_VIEW.setUint32(version, versions[0], true);
            HEAP_DATA_VIEW.setUint32(version + 4, versions[1], true);
            HEAP_DATA_VIEW.setUint32(version + 8, versions[2], true);
            return envObject.clearLastError();
        }
        var emnapiMod = /*#__PURE__*/ Object.freeze({
            __proto__: null,
            $emnapiGetMemoryAddress: $emnapiGetMemoryAddress,
            $emnapiSyncMemory: $emnapiSyncMemory,
            emnapi_create_memory_view: emnapi_create_memory_view,
            emnapi_get_memory_address: emnapi_get_memory_address,
            emnapi_get_runtime_version: emnapi_get_runtime_version,
            emnapi_is_node_binding_available: emnapi_is_node_binding_available,
            emnapi_is_support_bigint: emnapi_is_support_bigint,
            emnapi_is_support_weakref: emnapi_is_support_weakref,
            emnapi_sync_memory: emnapi_sync_memory
        });
        /**
         * @__sig ipp
         */
        function napi_create_array(env, result) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!result)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var value = emnapiCtx.addToCurrentScope([]).id;
            var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
            HEAP_DATA_VIEW.setInt32(result, value, true);
            return envObject.clearLastError();
        }
        /**
         * @__sig ippp
         */
        function napi_create_array_with_length(env, length, result) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!result)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            length = length >>> 0;
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var value = emnapiCtx.addToCurrentScope(new Array(length)).id;
            var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
            HEAP_DATA_VIEW.setInt32(result, value, true);
            return envObject.clearLastError();
        }
        function emnapiCreateArrayBuffer(byte_length, data) {
            byte_length = byte_length >>> 0;
            var arrayBuffer = new ArrayBuffer(byte_length);
            if (data) {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                var p = emnapiExternalMemory.getArrayBufferPointer(arrayBuffer, true).address;
                var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
                HEAP_DATA_VIEW.setInt32(data, p, true);
            }
            return arrayBuffer;
        }
        /**
         * @__sig ipppp
         */
        function napi_create_arraybuffer(env, byte_length, data, result) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var value;
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!envObject.tryCatch.isEmpty())
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            if (!envObject.canCallIntoJs())
                return envObject.setLastError(envObject.moduleApiVersion === 2147483647 /* Version.NAPI_VERSION_EXPERIMENTAL */ ? 23 /* napi_status.napi_cannot_run_js */ : 10 /* napi_status.napi_pending_exception */);
            envObject.clearLastError();
            try {
                if (!result)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                var arrayBuffer = emnapiCreateArrayBuffer(byte_length, data);
                value = emnapiCtx.addToCurrentScope(arrayBuffer).id;
                var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
                HEAP_DATA_VIEW.setInt32(result, value, true);
                return envObject.getReturnStatus();
            }
            catch (err) {
                envObject.tryCatch.setError(err);
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            }
        }
        /**
         * @__sig ipdp
         */
        function napi_create_date(env, time, result) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var value;
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!envObject.tryCatch.isEmpty())
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            if (!envObject.canCallIntoJs())
                return envObject.setLastError(envObject.moduleApiVersion === 2147483647 /* Version.NAPI_VERSION_EXPERIMENTAL */ ? 23 /* napi_status.napi_cannot_run_js */ : 10 /* napi_status.napi_pending_exception */);
            envObject.clearLastError();
            try {
                if (!result)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                value = emnapiCtx.addToCurrentScope(new Date(time)).id;
                var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
                HEAP_DATA_VIEW.setInt32(result, value, true);
                return envObject.getReturnStatus();
            }
            catch (err) {
                envObject.tryCatch.setError(err);
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            }
        }
        /**
         * @__sig ippppp
         */
        function napi_create_external(env, data, finalize_cb, finalize_hint, result) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var value;
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!envObject.tryCatch.isEmpty())
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            if (!envObject.canCallIntoJs())
                return envObject.setLastError(envObject.moduleApiVersion === 2147483647 /* Version.NAPI_VERSION_EXPERIMENTAL */ ? 23 /* napi_status.napi_cannot_run_js */ : 10 /* napi_status.napi_pending_exception */);
            envObject.clearLastError();
            try {
                if (!result)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                if (!emnapiCtx.feature.supportFinalizer && finalize_cb) {
                    throw emnapiCtx.createNotSupportWeakRefError('napi_create_external', 'Parameter "finalize_cb" must be 0(NULL)');
                }
                var externalHandle = emnapiCtx.getCurrentScope().addExternal(envObject, data);
                if (finalize_cb) {
                    emnapiCtx.createReference(envObject, externalHandle.id, 0, 0 /* Ownership.kRuntime */, finalize_cb, data, finalize_hint);
                }
                value = externalHandle.id;
                var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
                HEAP_DATA_VIEW.setInt32(result, value, true);
                return envObject.clearLastError();
            }
            catch (err) {
                envObject.tryCatch.setError(err);
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            }
        }
        /**
         * @__sig ipppppp
         */
        function napi_create_external_arraybuffer(env, external_data, byte_length, finalize_cb, finalize_hint, result) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var value;
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!envObject.tryCatch.isEmpty())
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            if (!envObject.canCallIntoJs())
                return envObject.setLastError(envObject.moduleApiVersion === 2147483647 /* Version.NAPI_VERSION_EXPERIMENTAL */ ? 23 /* napi_status.napi_cannot_run_js */ : 10 /* napi_status.napi_pending_exception */);
            envObject.clearLastError();
            try {
                if (!result)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                byte_length = byte_length >>> 0;
                if (!external_data) {
                    byte_length = 0;
                }
                if ((external_data + byte_length) > wasmMemory.buffer.byteLength) {
                    throw new RangeError('Memory out of range');
                }
                if (!emnapiCtx.feature.supportFinalizer && finalize_cb) {
                    throw emnapiCtx.createNotSupportWeakRefError('napi_create_external_arraybuffer', 'Parameter "finalize_cb" must be 0(NULL)');
                }
                var arrayBuffer = new ArrayBuffer(byte_length);
                if (byte_length === 0) {
                    try {
                        var MessageChannel_1 = emnapiCtx.feature.MessageChannel;
                        var messageChannel = new MessageChannel_1();
                        messageChannel.port1.postMessage(arrayBuffer, [arrayBuffer]);
                    }
                    catch (_) { }
                }
                else {
                    var u8arr = new Uint8Array(arrayBuffer);
                    u8arr.set(new Uint8Array(wasmMemory.buffer).subarray(external_data, external_data + byte_length));
                    emnapiExternalMemory.table.set(arrayBuffer, {
                        address: external_data,
                        ownership: 1 /* Ownership.kUserland */,
                        runtimeAllocated: 0
                    });
                }
                var handle = emnapiCtx.addToCurrentScope(arrayBuffer);
                if (finalize_cb) {
                    var status_1 = napi_add_finalizer(env, handle.id, external_data, finalize_cb, finalize_hint, /* NULL */ 0);
                    if (status_1 === 10 /* napi_status.napi_pending_exception */) {
                        var err = envObject.tryCatch.extractException();
                        envObject.clearLastError();
                        throw err;
                    }
                    else if (status_1 !== 0 /* napi_status.napi_ok */) {
                        return envObject.setLastError(status_1);
                    }
                }
                value = handle.id;
                var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
                HEAP_DATA_VIEW.setInt32(result, value, true);
                return envObject.getReturnStatus();
            }
            catch (err) {
                envObject.tryCatch.setError(err);
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            }
        }
        /**
         * @__sig ipp
         */
        function napi_create_object(env, result) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!result)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var value = emnapiCtx.addToCurrentScope({}).id;
            var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
            HEAP_DATA_VIEW.setInt32(result, value, true);
            return envObject.clearLastError();
        }
        /**
         * @__sig ippp
         */
        function napi_create_symbol(env, description, result) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!result)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
            if (!description) {
                // eslint-disable-next-line symbol-description, @typescript-eslint/no-unused-vars
                var value = emnapiCtx.addToCurrentScope(Symbol()).id;
                HEAP_DATA_VIEW.setInt32(result, value, true);
            }
            else {
                var handle = emnapiCtx.handleStore.get(description);
                var desc = handle.value;
                if (typeof desc !== 'string') {
                    return envObject.setLastError(3 /* napi_status.napi_string_expected */);
                }
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                var v = emnapiCtx.addToCurrentScope(Symbol(desc)).id;
                HEAP_DATA_VIEW.setInt32(result, v, true);
            }
            return envObject.clearLastError();
        }
        /**
         * @__sig ipipppp
         */
        function napi_create_typedarray(env, type, length, arraybuffer, byte_offset, result) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var value;
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!envObject.tryCatch.isEmpty())
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            if (!envObject.canCallIntoJs())
                return envObject.setLastError(envObject.moduleApiVersion === 2147483647 /* Version.NAPI_VERSION_EXPERIMENTAL */ ? 23 /* napi_status.napi_cannot_run_js */ : 10 /* napi_status.napi_pending_exception */);
            envObject.clearLastError();
            try {
                if (!arraybuffer)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                if (!result)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                var handle = emnapiCtx.handleStore.get(arraybuffer);
                var buffer = handle.value;
                if (!(buffer instanceof ArrayBuffer)) {
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                }
                var createTypedArray = function (envObject, Type, size_of_element, buffer, byte_offset, length) {
                    var _a;
                    byte_offset = byte_offset >>> 0;
                    length = length >>> 0;
                    if (size_of_element > 1) {
                        if ((byte_offset) % (size_of_element) !== 0) {
                            var err = new RangeError("start offset of ".concat((_a = Type.name) !== null && _a !== void 0 ? _a : '', " should be a multiple of ").concat(size_of_element));
                            err.code = 'ERR_NAPI_INVALID_TYPEDARRAY_ALIGNMENT';
                            envObject.tryCatch.setError(err);
                            return envObject.setLastError(9 /* napi_status.napi_generic_failure */);
                        }
                    }
                    if (((length * size_of_element) + byte_offset) > buffer.byteLength) {
                        var err = new RangeError('Invalid typed array length');
                        err.code = 'ERR_NAPI_INVALID_TYPEDARRAY_LENGTH';
                        envObject.tryCatch.setError(err);
                        return envObject.setLastError(9 /* napi_status.napi_generic_failure */);
                    }
                    var out = new Type(buffer, byte_offset, length);
                    if (buffer === wasmMemory.buffer) {
                        if (!emnapiExternalMemory.wasmMemoryViewTable.has(out)) {
                            emnapiExternalMemory.wasmMemoryViewTable.set(out, {
                                Ctor: Type,
                                address: byte_offset,
                                length: length,
                                ownership: 1 /* Ownership.kUserland */,
                                runtimeAllocated: 0
                            });
                        }
                    }
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    value = emnapiCtx.addToCurrentScope(out).id;
                    var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
                    HEAP_DATA_VIEW.setInt32(result, value, true);
                    return envObject.getReturnStatus();
                };
                switch (type) {
                    case 0 /* napi_typedarray_type.napi_int8_array */:
                        return createTypedArray(envObject, Int8Array, 1, buffer, byte_offset, length);
                    case 1 /* napi_typedarray_type.napi_uint8_array */:
                        return createTypedArray(envObject, Uint8Array, 1, buffer, byte_offset, length);
                    case 2 /* napi_typedarray_type.napi_uint8_clamped_array */:
                        return createTypedArray(envObject, Uint8ClampedArray, 1, buffer, byte_offset, length);
                    case 3 /* napi_typedarray_type.napi_int16_array */:
                        return createTypedArray(envObject, Int16Array, 2, buffer, byte_offset, length);
                    case 4 /* napi_typedarray_type.napi_uint16_array */:
                        return createTypedArray(envObject, Uint16Array, 2, buffer, byte_offset, length);
                    case 5 /* napi_typedarray_type.napi_int32_array */:
                        return createTypedArray(envObject, Int32Array, 4, buffer, byte_offset, length);
                    case 6 /* napi_typedarray_type.napi_uint32_array */:
                        return createTypedArray(envObject, Uint32Array, 4, buffer, byte_offset, length);
                    case 7 /* napi_typedarray_type.napi_float32_array */:
                        return createTypedArray(envObject, Float32Array, 4, buffer, byte_offset, length);
                    case 8 /* napi_typedarray_type.napi_float64_array */:
                        return createTypedArray(envObject, Float64Array, 8, buffer, byte_offset, length);
                    case 9 /* napi_typedarray_type.napi_bigint64_array */:
                        return createTypedArray(envObject, BigInt64Array, 8, buffer, byte_offset, length);
                    case 10 /* napi_typedarray_type.napi_biguint64_array */:
                        return createTypedArray(envObject, BigUint64Array, 8, buffer, byte_offset, length);
                    default:
                        return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                }
            }
            catch (err) {
                envObject.tryCatch.setError(err);
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            }
        }
        /**
         * @__deps malloc
         * @__sig ippp
         */
        function napi_create_buffer(env, size, data, result) {
            var _a;
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var value, pointer;
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!envObject.tryCatch.isEmpty())
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            if (!envObject.canCallIntoJs())
                return envObject.setLastError(envObject.moduleApiVersion === 2147483647 /* Version.NAPI_VERSION_EXPERIMENTAL */ ? 23 /* napi_status.napi_cannot_run_js */ : 10 /* napi_status.napi_pending_exception */);
            envObject.clearLastError();
            try {
                if (!result)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                var Buffer = emnapiCtx.feature.Buffer;
                if (!Buffer) {
                    throw emnapiCtx.createNotSupportBufferError('napi_create_buffer', '');
                }
                var buffer = void 0;
                size = size >>> 0;
                var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
                if (!data || (size === 0)) {
                    buffer = Buffer.alloc(size);
                    value = emnapiCtx.addToCurrentScope(buffer).id;
                    HEAP_DATA_VIEW.setInt32(result, value, true);
                }
                else {
                    pointer = _malloc(size);
                    if (!pointer)
                        throw new Error('Out of memory');
                    new Uint8Array(wasmMemory.buffer).subarray(pointer, pointer + size).fill(0);
                    var buffer_1 = Buffer.from(wasmMemory.buffer, pointer, size);
                    var viewDescriptor = {
                        Ctor: Buffer,
                        address: pointer,
                        length: size,
                        ownership: emnapiExternalMemory.registry ? 0 /* Ownership.kRuntime */ : 1 /* Ownership.kUserland */,
                        runtimeAllocated: 1
                    };
                    emnapiExternalMemory.wasmMemoryViewTable.set(buffer_1, viewDescriptor);
                    (_a = emnapiExternalMemory.registry) === null || _a === void 0 ? void 0 : _a.register(viewDescriptor, pointer);
                    value = emnapiCtx.addToCurrentScope(buffer_1).id;
                    HEAP_DATA_VIEW.setInt32(result, value, true);
                    HEAP_DATA_VIEW.setInt32(data, pointer, true);
                }
                return envObject.getReturnStatus();
            }
            catch (err) {
                envObject.tryCatch.setError(err);
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            }
        }
        /**
         * @__sig ippppp
         */
        function napi_create_buffer_copy(env, length, data, result_data, result) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var value;
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!envObject.tryCatch.isEmpty())
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            if (!envObject.canCallIntoJs())
                return envObject.setLastError(envObject.moduleApiVersion === 2147483647 /* Version.NAPI_VERSION_EXPERIMENTAL */ ? 23 /* napi_status.napi_cannot_run_js */ : 10 /* napi_status.napi_pending_exception */);
            envObject.clearLastError();
            try {
                if (!result)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                var Buffer = emnapiCtx.feature.Buffer;
                if (!Buffer) {
                    throw emnapiCtx.createNotSupportBufferError('napi_create_buffer_copy', '');
                }
                var arrayBuffer = emnapiCreateArrayBuffer(length, result_data);
                var buffer = Buffer.from(arrayBuffer);
                buffer.set(new Uint8Array(wasmMemory.buffer).subarray(data, data + length));
                value = emnapiCtx.addToCurrentScope(buffer).id;
                var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
                HEAP_DATA_VIEW.setInt32(result, value, true);
                return envObject.getReturnStatus();
            }
            catch (err) {
                envObject.tryCatch.setError(err);
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            }
        }
        /**
         * @__sig ipppppp
         */
        function napi_create_external_buffer(env, length, data, finalize_cb, finalize_hint, result) {
            return emnapi_create_memory_view(env, -2 /* emnapi_memory_view_type.emnapi_buffer */, data, length, finalize_cb, finalize_hint, result);
        }
        /**
         * @__sig ippppp
         */
        function napi_create_dataview(env, byte_length, arraybuffer, byte_offset, result) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var value;
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!envObject.tryCatch.isEmpty())
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            if (!envObject.canCallIntoJs())
                return envObject.setLastError(envObject.moduleApiVersion === 2147483647 /* Version.NAPI_VERSION_EXPERIMENTAL */ ? 23 /* napi_status.napi_cannot_run_js */ : 10 /* napi_status.napi_pending_exception */);
            envObject.clearLastError();
            try {
                if (!arraybuffer)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                if (!result)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                byte_length = byte_length >>> 0;
                byte_offset = byte_offset >>> 0;
                var handle = emnapiCtx.handleStore.get(arraybuffer);
                var buffer = handle.value;
                if (!(buffer instanceof ArrayBuffer)) {
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                }
                if ((byte_length + byte_offset) > buffer.byteLength) {
                    var err = new RangeError('byte_offset + byte_length should be less than or equal to the size in bytes of the array passed in');
                    err.code = 'ERR_NAPI_INVALID_DATAVIEW_ARGS';
                    throw err;
                }
                var dataview = new DataView(buffer, byte_offset, byte_length);
                if (buffer === wasmMemory.buffer) {
                    if (!emnapiExternalMemory.wasmMemoryViewTable.has(dataview)) {
                        emnapiExternalMemory.wasmMemoryViewTable.set(dataview, {
                            Ctor: DataView,
                            address: byte_offset,
                            length: byte_length,
                            ownership: 1 /* Ownership.kUserland */,
                            runtimeAllocated: 0
                        });
                    }
                }
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                value = emnapiCtx.addToCurrentScope(dataview).id;
                var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
                HEAP_DATA_VIEW.setInt32(result, value, true);
                return envObject.getReturnStatus();
            }
            catch (err) {
                envObject.tryCatch.setError(err);
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            }
        }
        /**
         * @__sig ipppp
         */
        function node_api_symbol_for(env, utf8description, length, result) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!result)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            var autoLength = length === -1;
            var sizelength = length >>> 0;
            if (length !== 0) {
                if (!utf8description)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            }
            if (!(autoLength || (sizelength <= 2147483647))) {
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            }
            var descriptionString = emnapiString.UTF8ToString(utf8description, length);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var value = emnapiCtx.addToCurrentScope(Symbol.for(descriptionString)).id;
            var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
            HEAP_DATA_VIEW.setInt32(result, value, true);
            return envObject.clearLastError();
        }
        var createMod = /*#__PURE__*/ Object.freeze({
            __proto__: null,
            napi_create_array: napi_create_array,
            napi_create_array_with_length: napi_create_array_with_length,
            napi_create_arraybuffer: napi_create_arraybuffer,
            napi_create_buffer: napi_create_buffer,
            napi_create_buffer_copy: napi_create_buffer_copy,
            napi_create_dataview: napi_create_dataview,
            napi_create_date: napi_create_date,
            napi_create_external: napi_create_external,
            napi_create_external_arraybuffer: napi_create_external_arraybuffer,
            napi_create_external_buffer: napi_create_external_buffer,
            napi_create_object: napi_create_object,
            napi_create_symbol: napi_create_symbol,
            napi_create_typedarray: napi_create_typedarray,
            node_api_symbol_for: node_api_symbol_for
        });
        /** @__sig ipip */
        function napi_get_boolean(env, value, result) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!result)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var v = value === 0 ? 3 /* GlobalHandle.FALSE */ : 4 /* GlobalHandle.TRUE */;
            var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
            HEAP_DATA_VIEW.setInt32(result, v, true);
            return envObject.clearLastError();
        }
        /** @__sig ipp */
        function napi_get_global(env, result) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!result)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var value = 5 /* GlobalHandle.GLOBAL */;
            var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
            HEAP_DATA_VIEW.setInt32(result, value, true);
            return envObject.clearLastError();
        }
        /** @__sig ipp */
        function napi_get_null(env, result) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!result)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var value = 2 /* GlobalHandle.NULL */;
            var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
            HEAP_DATA_VIEW.setInt32(result, value, true);
            return envObject.clearLastError();
        }
        /** @__sig ipp */
        function napi_get_undefined(env, result) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!result)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var value = 1 /* GlobalHandle.UNDEFINED */;
            var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
            HEAP_DATA_VIEW.setInt32(result, value, true);
            return envObject.clearLastError();
        }
        var globalMod = /*#__PURE__*/ Object.freeze({
            __proto__: null,
            napi_get_boolean: napi_get_boolean,
            napi_get_global: napi_get_global,
            napi_get_null: napi_get_null,
            napi_get_undefined: napi_get_undefined
        });
        /** @__sig ipppp */
        function napi_set_instance_data(env, data, finalize_cb, finalize_hint) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            var envObject = emnapiCtx.envStore.get(env);
            envObject.setInstanceData(data, finalize_cb, finalize_hint);
            return envObject.clearLastError();
        }
        /** @__sig ipp */
        function napi_get_instance_data(env, data) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            var envObject = emnapiCtx.envStore.get(env);
            if (!data)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var value = envObject.getInstanceData();
            var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
            HEAP_DATA_VIEW.setInt32(data, value, true);
            return envObject.clearLastError();
        }
        var envMod = /*#__PURE__*/ Object.freeze({
            __proto__: null,
            napi_get_instance_data: napi_get_instance_data,
            napi_set_instance_data: napi_set_instance_data
        });
        /** @__sig vpppp */
        function _emnapi_get_last_error_info(env, error_code, engine_error_code, engine_reserved) {
            var envObject = emnapiCtx.envStore.get(env);
            var lastError = envObject.lastError;
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var errorCode = lastError.errorCode;
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var engineErrorCode = lastError.engineErrorCode >>> 0;
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var engineReserved = lastError.engineReserved;
            var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
            HEAP_DATA_VIEW.setInt32(error_code, errorCode, true);
            HEAP_DATA_VIEW.setUint32(engine_error_code, engineErrorCode, true);
            HEAP_DATA_VIEW.setInt32(engine_reserved, engineReserved, true);
        }
        /** @__sig ipp */
        function napi_throw(env, error) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!envObject.tryCatch.isEmpty())
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            if (!envObject.canCallIntoJs())
                return envObject.setLastError(envObject.moduleApiVersion === 2147483647 /* Version.NAPI_VERSION_EXPERIMENTAL */ ? 23 /* napi_status.napi_cannot_run_js */ : 10 /* napi_status.napi_pending_exception */);
            envObject.clearLastError();
            try {
                if (!error)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                envObject.tryCatch.setError(emnapiCtx.handleStore.get(error).value);
                return envObject.clearLastError();
            }
            catch (err) {
                envObject.tryCatch.setError(err);
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            }
        }
        /** @__sig ippp */
        function napi_throw_error(env, code, msg) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!envObject.tryCatch.isEmpty())
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            if (!envObject.canCallIntoJs())
                return envObject.setLastError(envObject.moduleApiVersion === 2147483647 /* Version.NAPI_VERSION_EXPERIMENTAL */ ? 23 /* napi_status.napi_cannot_run_js */ : 10 /* napi_status.napi_pending_exception */);
            envObject.clearLastError();
            try {
                if (!msg)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                var error = new Error(emnapiString.UTF8ToString(msg, -1));
                if (code)
                    error.code = emnapiString.UTF8ToString(code, -1);
                envObject.tryCatch.setError(error);
                return envObject.clearLastError();
            }
            catch (err) {
                envObject.tryCatch.setError(err);
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            }
        }
        /** @__sig ippp */
        function napi_throw_type_error(env, code, msg) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!envObject.tryCatch.isEmpty())
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            if (!envObject.canCallIntoJs())
                return envObject.setLastError(envObject.moduleApiVersion === 2147483647 /* Version.NAPI_VERSION_EXPERIMENTAL */ ? 23 /* napi_status.napi_cannot_run_js */ : 10 /* napi_status.napi_pending_exception */);
            envObject.clearLastError();
            try {
                if (!msg)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                var error = new TypeError(emnapiString.UTF8ToString(msg, -1));
                if (code)
                    error.code = emnapiString.UTF8ToString(code, -1);
                envObject.tryCatch.setError(error);
                return envObject.clearLastError();
            }
            catch (err) {
                envObject.tryCatch.setError(err);
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            }
        }
        /** @__sig ippp */
        function napi_throw_range_error(env, code, msg) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!envObject.tryCatch.isEmpty())
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            if (!envObject.canCallIntoJs())
                return envObject.setLastError(envObject.moduleApiVersion === 2147483647 /* Version.NAPI_VERSION_EXPERIMENTAL */ ? 23 /* napi_status.napi_cannot_run_js */ : 10 /* napi_status.napi_pending_exception */);
            envObject.clearLastError();
            try {
                if (!msg)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                var error = new RangeError(emnapiString.UTF8ToString(msg, -1));
                if (code)
                    error.code = emnapiString.UTF8ToString(code, -1);
                envObject.tryCatch.setError(error);
                return envObject.clearLastError();
            }
            catch (err) {
                envObject.tryCatch.setError(err);
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            }
        }
        /** @__sig ippp */
        function node_api_throw_syntax_error(env, code, msg) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!envObject.tryCatch.isEmpty())
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            if (!envObject.canCallIntoJs())
                return envObject.setLastError(envObject.moduleApiVersion === 2147483647 /* Version.NAPI_VERSION_EXPERIMENTAL */ ? 23 /* napi_status.napi_cannot_run_js */ : 10 /* napi_status.napi_pending_exception */);
            envObject.clearLastError();
            try {
                if (!msg)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                var error = new SyntaxError(emnapiString.UTF8ToString(msg, -1));
                if (code)
                    error.code = emnapiString.UTF8ToString(code, -1);
                envObject.tryCatch.setError(error);
                return envObject.clearLastError();
            }
            catch (err) {
                envObject.tryCatch.setError(err);
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            }
        }
        /** @__sig ipp */
        function napi_is_exception_pending(env, result) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!result)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var r = envObject.tryCatch.hasCaught();
            var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
            HEAP_DATA_VIEW.setInt8(result, r ? 1 : 0, true);
            return envObject.clearLastError();
        }
        /** @__sig ipppp */
        function napi_create_error(env, code, msg, result) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!msg)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            if (!result)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            var msgValue = emnapiCtx.handleStore.get(msg).value;
            if (typeof msgValue !== 'string') {
                return envObject.setLastError(3 /* napi_status.napi_string_expected */);
            }
            var error = new Error(msgValue);
            if (code) {
                var codeValue = emnapiCtx.handleStore.get(code).value;
                if (typeof codeValue !== 'string') {
                    return envObject.setLastError(3 /* napi_status.napi_string_expected */);
                }
                error.code = codeValue;
            }
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var value = emnapiCtx.addToCurrentScope(error).id;
            var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
            HEAP_DATA_VIEW.setInt32(result, value, true);
            return envObject.clearLastError();
        }
        /** @__sig ipppp */
        function napi_create_type_error(env, code, msg, result) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!msg)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            if (!result)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            var msgValue = emnapiCtx.handleStore.get(msg).value;
            if (typeof msgValue !== 'string') {
                return envObject.setLastError(3 /* napi_status.napi_string_expected */);
            }
            var error = new TypeError(msgValue);
            if (code) {
                var codeValue = emnapiCtx.handleStore.get(code).value;
                if (typeof codeValue !== 'string') {
                    return envObject.setLastError(3 /* napi_status.napi_string_expected */);
                }
                error.code = codeValue;
            }
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var value = emnapiCtx.addToCurrentScope(error).id;
            var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
            HEAP_DATA_VIEW.setInt32(result, value, true);
            return envObject.clearLastError();
        }
        /** @__sig ipppp */
        function napi_create_range_error(env, code, msg, result) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!msg)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            if (!result)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            var msgValue = emnapiCtx.handleStore.get(msg).value;
            if (typeof msgValue !== 'string') {
                return envObject.setLastError(3 /* napi_status.napi_string_expected */);
            }
            var error = new RangeError(msgValue);
            if (code) {
                var codeValue = emnapiCtx.handleStore.get(code).value;
                if (typeof codeValue !== 'string') {
                    return envObject.setLastError(3 /* napi_status.napi_string_expected */);
                }
                error.code = codeValue;
            }
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var value = emnapiCtx.addToCurrentScope(error).id;
            var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
            HEAP_DATA_VIEW.setInt32(result, value, true);
            return envObject.clearLastError();
        }
        /** @__sig ipppp */
        function node_api_create_syntax_error(env, code, msg, result) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!msg)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            if (!result)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            var msgValue = emnapiCtx.handleStore.get(msg).value;
            if (typeof msgValue !== 'string') {
                return envObject.setLastError(3 /* napi_status.napi_string_expected */);
            }
            var error = new SyntaxError(msgValue);
            if (code) {
                var codeValue = emnapiCtx.handleStore.get(code).value;
                if (typeof codeValue !== 'string') {
                    return envObject.setLastError(3 /* napi_status.napi_string_expected */);
                }
                error.code = codeValue;
            }
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var value = emnapiCtx.addToCurrentScope(error).id;
            var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
            HEAP_DATA_VIEW.setInt32(result, value, true);
            return envObject.clearLastError();
        }
        /** @__sig ipp */
        function napi_get_and_clear_last_exception(env, result) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!result)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
            if (!envObject.tryCatch.hasCaught()) {
                HEAP_DATA_VIEW.setInt32(result, 1, true); // ID_UNDEFINED
                return envObject.clearLastError();
            }
            else {
                var err = envObject.tryCatch.exception();
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                var value = envObject.ensureHandleId(err);
                HEAP_DATA_VIEW.setInt32(result, value, true);
                envObject.tryCatch.reset();
            }
            return envObject.clearLastError();
        }
        /** @__sig vpppp */
        function napi_fatal_error(location, location_len, message, message_len) {
            var locationStr = emnapiString.UTF8ToString(location, location_len);
            var messageStr = emnapiString.UTF8ToString(message, message_len);
            if (emnapiNodeBinding) {
                emnapiNodeBinding.napi.fatalError(locationStr, messageStr);
            }
            else {
                abort('FATAL ERROR: ' + locationStr + ' ' + messageStr);
            }
        }
        /** @__sig ipp */
        function napi_fatal_exception(env, err) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!envObject.tryCatch.isEmpty())
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            if (!envObject.canCallIntoJs())
                return envObject.setLastError(envObject.moduleApiVersion === 2147483647 /* Version.NAPI_VERSION_EXPERIMENTAL */ ? 23 /* napi_status.napi_cannot_run_js */ : 10 /* napi_status.napi_pending_exception */);
            envObject.clearLastError();
            try {
                if (!err)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                var error = envObject.ctx.handleStore.get(err);
                try {
                    envObject.triggerFatalException(error.value);
                }
                catch (_) {
                    return envObject.setLastError(9 /* napi_status.napi_generic_failure */);
                }
                return envObject.clearLastError();
            }
            catch (err) {
                envObject.tryCatch.setError(err);
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            }
        }
        var errorMod = /*#__PURE__*/ Object.freeze({
            __proto__: null,
            _emnapi_get_last_error_info: _emnapi_get_last_error_info,
            napi_create_error: napi_create_error,
            napi_create_range_error: napi_create_range_error,
            napi_create_type_error: napi_create_type_error,
            napi_fatal_error: napi_fatal_error,
            napi_fatal_exception: napi_fatal_exception,
            napi_get_and_clear_last_exception: napi_get_and_clear_last_exception,
            napi_is_exception_pending: napi_is_exception_pending,
            napi_throw: napi_throw,
            napi_throw_error: napi_throw_error,
            napi_throw_range_error: napi_throw_range_error,
            napi_throw_type_error: napi_throw_type_error,
            node_api_create_syntax_error: node_api_create_syntax_error,
            node_api_throw_syntax_error: node_api_throw_syntax_error
        });
        /** @__sig ipppppp */
        function napi_create_function(env, utf8name, length, cb, data, result) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var value;
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!envObject.tryCatch.isEmpty())
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            if (!envObject.canCallIntoJs())
                return envObject.setLastError(envObject.moduleApiVersion === 2147483647 /* Version.NAPI_VERSION_EXPERIMENTAL */ ? 23 /* napi_status.napi_cannot_run_js */ : 10 /* napi_status.napi_pending_exception */);
            envObject.clearLastError();
            try {
                if (!result)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                if (!cb)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                var fresult = emnapiCreateFunction(envObject, utf8name, length, cb, data);
                if (fresult.status !== 0 /* napi_status.napi_ok */)
                    return envObject.setLastError(fresult.status);
                var f = fresult.f;
                var valueHandle = emnapiCtx.addToCurrentScope(f);
                value = valueHandle.id;
                var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
                HEAP_DATA_VIEW.setInt32(result, value, true);
                return envObject.getReturnStatus();
            }
            catch (err) {
                envObject.tryCatch.setError(err);
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            }
        }
        /** @__sig ipppppp */
        function napi_get_cb_info(env, cbinfo, argc, argv, this_arg, data) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            var envObject = emnapiCtx.envStore.get(env);
            if (!cbinfo)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            var cbinfoValue = emnapiCtx.cbinfoStack.get(cbinfo);
            var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
            if (argv) {
                if (!argc)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                var argcValue = HEAP_DATA_VIEW.getUint32(argc, true);
                var len = cbinfoValue.args.length;
                var arrlen = argcValue < len ? argcValue : len;
                var i = 0;
                for (; i < arrlen; i++) {
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    var argVal = envObject.ensureHandleId(cbinfoValue.args[i]);
                    HEAP_DATA_VIEW.setInt32(argv + i * 4, argVal, true);
                }
                if (i < argcValue) {
                    for (; i < argcValue; i++) {
                        HEAP_DATA_VIEW.setInt32(argv + i * 4, 1, true);
                    }
                }
            }
            if (argc) {
                HEAP_DATA_VIEW.setUint32(argc, cbinfoValue.args.length, true);
            }
            if (this_arg) {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                var v = envObject.ensureHandleId(cbinfoValue.thiz);
                HEAP_DATA_VIEW.setInt32(this_arg, v, true);
            }
            if (data) {
                HEAP_DATA_VIEW.setInt32(data, cbinfoValue.data, true);
            }
            return envObject.clearLastError();
        }
        /** @__sig ipppppp */
        function napi_call_function(env, recv, func, argc, argv, result) {
            var i = 0;
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var v;
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!envObject.tryCatch.isEmpty())
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            if (!envObject.canCallIntoJs())
                return envObject.setLastError(envObject.moduleApiVersion === 2147483647 /* Version.NAPI_VERSION_EXPERIMENTAL */ ? 23 /* napi_status.napi_cannot_run_js */ : 10 /* napi_status.napi_pending_exception */);
            envObject.clearLastError();
            try {
                if (!recv)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                argc = argc >>> 0;
                if (argc > 0) {
                    if (!argv)
                        return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                }
                var v8recv = emnapiCtx.handleStore.get(recv).value;
                if (!func)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                var v8func = emnapiCtx.handleStore.get(func).value;
                if (typeof v8func !== 'function')
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                var args = [];
                var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
                for (; i < argc; i++) {
                    var argVal = HEAP_DATA_VIEW.getInt32(argv + i * 4, true);
                    args.push(emnapiCtx.handleStore.get(argVal).value);
                }
                var ret = v8func.apply(v8recv, args);
                if (result) {
                    v = envObject.ensureHandleId(ret);
                    HEAP_DATA_VIEW.setInt32(result, v, true);
                }
                return envObject.clearLastError();
            }
            catch (err) {
                envObject.tryCatch.setError(err);
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            }
        }
        /** @__sig ippppp */
        function napi_new_instance(env, constructor, argc, argv, result) {
            var i;
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var v;
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!envObject.tryCatch.isEmpty())
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            if (!envObject.canCallIntoJs())
                return envObject.setLastError(envObject.moduleApiVersion === 2147483647 /* Version.NAPI_VERSION_EXPERIMENTAL */ ? 23 /* napi_status.napi_cannot_run_js */ : 10 /* napi_status.napi_pending_exception */);
            envObject.clearLastError();
            try {
                if (!constructor)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                argc = argc >>> 0;
                if (argc > 0) {
                    if (!argv)
                        return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                }
                if (!result)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                var Ctor = emnapiCtx.handleStore.get(constructor).value;
                if (typeof Ctor !== 'function')
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                var ret = void 0;
                var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
                if (emnapiCtx.feature.supportReflect) {
                    var argList = Array(argc);
                    for (i = 0; i < argc; i++) {
                        var argVal = HEAP_DATA_VIEW.getInt32(argv + i * 4, true);
                        argList[i] = emnapiCtx.handleStore.get(argVal).value;
                    }
                    ret = Reflect.construct(Ctor, argList, Ctor);
                }
                else {
                    var args = Array(argc + 1);
                    args[0] = undefined;
                    for (i = 0; i < argc; i++) {
                        var argVal = HEAP_DATA_VIEW.getInt32(argv + i * 4, true);
                        args[i + 1] = emnapiCtx.handleStore.get(argVal).value;
                    }
                    var BoundCtor = Ctor.bind.apply(Ctor, args);
                    ret = new BoundCtor();
                }
                if (result) {
                    v = envObject.ensureHandleId(ret);
                    HEAP_DATA_VIEW.setInt32(result, v, true);
                }
                return envObject.getReturnStatus();
            }
            catch (err) {
                envObject.tryCatch.setError(err);
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            }
        }
        /** @__sig ippp */
        function napi_get_new_target(env, cbinfo, result) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!cbinfo)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            if (!result)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            var cbinfoValue = emnapiCtx.cbinfoStack.get(cbinfo);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var value = cbinfoValue.getNewTarget(envObject);
            var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
            HEAP_DATA_VIEW.setInt32(result, value, true);
            return envObject.clearLastError();
        }
        var functionMod = /*#__PURE__*/ Object.freeze({
            __proto__: null,
            napi_call_function: napi_call_function,
            napi_create_function: napi_create_function,
            napi_get_cb_info: napi_get_cb_info,
            napi_get_new_target: napi_get_new_target,
            napi_new_instance: napi_new_instance
        });
        /** @__sig ipp */
        function napi_open_handle_scope(env, result) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!result)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var scope = emnapiCtx.openScope(envObject);
            var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
            HEAP_DATA_VIEW.setInt32(result, scope.id, true);
            return envObject.clearLastError();
        }
        /** @__sig ipp */
        function napi_close_handle_scope(env, scope) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!scope)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            if ((envObject.openHandleScopes === 0)) {
                return 13 /* napi_status.napi_handle_scope_mismatch */;
            }
            emnapiCtx.closeScope(envObject);
            return envObject.clearLastError();
        }
        /** @__sig ipp */
        function napi_open_escapable_handle_scope(env, result) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!result)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var scope = emnapiCtx.openScope(envObject);
            var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
            HEAP_DATA_VIEW.setInt32(result, scope.id, true);
            return envObject.clearLastError();
        }
        /** @__sig ipp */
        function napi_close_escapable_handle_scope(env, scope) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!scope)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            if ((envObject.openHandleScopes === 0)) {
                return 13 /* napi_status.napi_handle_scope_mismatch */;
            }
            emnapiCtx.closeScope(envObject);
            return envObject.clearLastError();
        }
        /** @__sig ipppp */
        function napi_escape_handle(env, scope, escapee, result) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!scope)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            if (!escapee)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            if (!result)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            var scopeObject = emnapiCtx.scopeStore.get(scope);
            if (!scopeObject.escapeCalled()) {
                var newHandle = scopeObject.escape(escapee);
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                var value = newHandle ? newHandle.id : 0;
                var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
                HEAP_DATA_VIEW.setInt32(result, value, true);
                return envObject.clearLastError();
            }
            return envObject.setLastError(12 /* napi_status.napi_escape_called_twice */);
        }
        /** @__sig ippip */
        function napi_create_reference(env, value, initial_refcount, result) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!value)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            if (!result)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            var handle = emnapiCtx.handleStore.get(value);
            if (envObject.moduleApiVersion !== 2147483647 /* Version.NAPI_VERSION_EXPERIMENTAL */) {
                if (!(handle.isObject() || handle.isFunction() || handle.isSymbol())) {
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                }
            }
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var ref = emnapiCtx.createReference(envObject, handle.id, initial_refcount >>> 0, 1 /* Ownership.kUserland */);
            var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
            HEAP_DATA_VIEW.setInt32(result, ref.id, true);
            return envObject.clearLastError();
        }
        /** @__sig ipp */
        function napi_delete_reference(env, ref) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!ref)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            emnapiCtx.refStore.get(ref).dispose();
            return envObject.clearLastError();
        }
        /** @__sig ippp */
        function napi_reference_ref(env, ref, result) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!ref)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var count = emnapiCtx.refStore.get(ref).ref();
            if (result) {
                var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
                HEAP_DATA_VIEW.setUint32(result, count, true);
            }
            return envObject.clearLastError();
        }
        /** @__sig ippp */
        function napi_reference_unref(env, ref, result) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!ref)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            var reference = emnapiCtx.refStore.get(ref);
            var refcount = reference.refCount();
            if (refcount === 0) {
                return envObject.setLastError(9 /* napi_status.napi_generic_failure */);
            }
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var count = reference.unref();
            if (result) {
                var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
                HEAP_DATA_VIEW.setUint32(result, count, true);
            }
            return envObject.clearLastError();
        }
        /** @__sig ippp */
        function napi_get_reference_value(env, ref, result) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!ref)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            if (!result)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            var reference = emnapiCtx.refStore.get(ref);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var handleId = reference.get();
            var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
            HEAP_DATA_VIEW.setInt32(result, handleId, true);
            return envObject.clearLastError();
        }
        /** @__sig ippp */
        function napi_add_env_cleanup_hook(env, fun, arg) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            var envObject = emnapiCtx.envStore.get(env);
            if (!fun)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            emnapiCtx.addCleanupHook(envObject, fun, arg);
            return 0 /* napi_status.napi_ok */;
        }
        /** @__sig ippp */
        function napi_remove_env_cleanup_hook(env, fun, arg) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            var envObject = emnapiCtx.envStore.get(env);
            if (!fun)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            emnapiCtx.removeCleanupHook(envObject, fun, arg);
            return 0 /* napi_status.napi_ok */;
        }
        /** @__sig vp */
        function _emnapi_env_ref(env) {
            var envObject = emnapiCtx.envStore.get(env);
            envObject.ref();
        }
        /** @__sig vp */
        function _emnapi_env_unref(env) {
            var envObject = emnapiCtx.envStore.get(env);
            envObject.unref();
        }
        var lifeMod = /*#__PURE__*/ Object.freeze({
            __proto__: null,
            _emnapi_env_ref: _emnapi_env_ref,
            _emnapi_env_unref: _emnapi_env_unref,
            napi_add_env_cleanup_hook: napi_add_env_cleanup_hook,
            napi_close_escapable_handle_scope: napi_close_escapable_handle_scope,
            napi_close_handle_scope: napi_close_handle_scope,
            napi_create_reference: napi_create_reference,
            napi_delete_reference: napi_delete_reference,
            napi_escape_handle: napi_escape_handle,
            napi_get_reference_value: napi_get_reference_value,
            napi_open_escapable_handle_scope: napi_open_escapable_handle_scope,
            napi_open_handle_scope: napi_open_handle_scope,
            napi_reference_ref: napi_reference_ref,
            napi_reference_unref: napi_reference_unref,
            napi_remove_env_cleanup_hook: napi_remove_env_cleanup_hook
        });
        /** @__sig ippi */
        function _emnapi_get_filename(env, buf, len) {
            var envObject = emnapiCtx.envStore.get(env);
            var filename = envObject.filename;
            if (!buf) {
                return emnapiString.lengthBytesUTF8(filename);
            }
            return emnapiString.stringToUTF8(filename, buf, len);
        }
        var miscellaneousMod = /*#__PURE__*/ Object.freeze({
            __proto__: null,
            _emnapi_get_filename: _emnapi_get_filename
        });
        /** @__sig ippp */
        function napi_create_promise(env, deferred, promise) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var deferredObjectId, value;
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!envObject.tryCatch.isEmpty())
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            if (!envObject.canCallIntoJs())
                return envObject.setLastError(envObject.moduleApiVersion === 2147483647 /* Version.NAPI_VERSION_EXPERIMENTAL */ ? 23 /* napi_status.napi_cannot_run_js */ : 10 /* napi_status.napi_pending_exception */);
            envObject.clearLastError();
            try {
                if (!deferred)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                if (!promise)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
                var p = new Promise(function (resolve, reject) {
                    var deferredObject = emnapiCtx.createDeferred({ resolve: resolve, reject: reject });
                    deferredObjectId = deferredObject.id;
                    HEAP_DATA_VIEW.setInt32(deferred, deferredObjectId, true);
                });
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                value = emnapiCtx.addToCurrentScope(p).id;
                HEAP_DATA_VIEW.setInt32(promise, value, true);
                return envObject.getReturnStatus();
            }
            catch (err) {
                envObject.tryCatch.setError(err);
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            }
        }
        /** @__sig ippp */
        function napi_resolve_deferred(env, deferred, resolution) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!envObject.tryCatch.isEmpty())
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            if (!envObject.canCallIntoJs())
                return envObject.setLastError(envObject.moduleApiVersion === 2147483647 /* Version.NAPI_VERSION_EXPERIMENTAL */ ? 23 /* napi_status.napi_cannot_run_js */ : 10 /* napi_status.napi_pending_exception */);
            envObject.clearLastError();
            try {
                if (!deferred)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                if (!resolution)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                var deferredObject = emnapiCtx.deferredStore.get(deferred);
                deferredObject.resolve(emnapiCtx.handleStore.get(resolution).value);
                return envObject.getReturnStatus();
            }
            catch (err) {
                envObject.tryCatch.setError(err);
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            }
        }
        /** @__sig ippp */
        function napi_reject_deferred(env, deferred, resolution) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!envObject.tryCatch.isEmpty())
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            if (!envObject.canCallIntoJs())
                return envObject.setLastError(envObject.moduleApiVersion === 2147483647 /* Version.NAPI_VERSION_EXPERIMENTAL */ ? 23 /* napi_status.napi_cannot_run_js */ : 10 /* napi_status.napi_pending_exception */);
            envObject.clearLastError();
            try {
                if (!deferred)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                if (!resolution)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                var deferredObject = emnapiCtx.deferredStore.get(deferred);
                deferredObject.reject(emnapiCtx.handleStore.get(resolution).value);
                return envObject.getReturnStatus();
            }
            catch (err) {
                envObject.tryCatch.setError(err);
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            }
        }
        /** @__sig ippp */
        function napi_is_promise(env, value, is_promise) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!value)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            if (!is_promise)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            var h = emnapiCtx.handleStore.get(value);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var r = h.isPromise() ? 1 : 0;
            var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
            HEAP_DATA_VIEW.setInt8(is_promise, r, true);
            return envObject.clearLastError();
        }
        var promiseMod = /*#__PURE__*/ Object.freeze({
            __proto__: null,
            napi_create_promise: napi_create_promise,
            napi_is_promise: napi_is_promise,
            napi_reject_deferred: napi_reject_deferred,
            napi_resolve_deferred: napi_resolve_deferred
        });
        /** @__sig ippiiip */
        function napi_get_all_property_names(env, object, key_mode, key_filter, key_conversion, result) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var value;
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!envObject.tryCatch.isEmpty())
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            if (!envObject.canCallIntoJs())
                return envObject.setLastError(envObject.moduleApiVersion === 2147483647 /* Version.NAPI_VERSION_EXPERIMENTAL */ ? 23 /* napi_status.napi_cannot_run_js */ : 10 /* napi_status.napi_pending_exception */);
            envObject.clearLastError();
            try {
                if (!result)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                if (!object)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                var h = emnapiCtx.handleStore.get(object);
                if (h.value == null) {
                    throw new TypeError('Cannot convert undefined or null to object');
                }
                var obj = void 0;
                try {
                    obj = h.isObject() || h.isFunction() ? h.value : Object(h.value);
                }
                catch (_) {
                    return envObject.setLastError(2 /* napi_status.napi_object_expected */);
                }
                if (key_mode !== 0 /* napi_key_collection_mode.napi_key_include_prototypes */ && key_mode !== 1 /* napi_key_collection_mode.napi_key_own_only */) {
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                }
                if (key_conversion !== 0 /* napi_key_conversion.napi_key_keep_numbers */ && key_conversion !== 1 /* napi_key_conversion.napi_key_numbers_to_strings */) {
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                }
                var props = [];
                var names = void 0;
                var symbols = void 0;
                var i = void 0;
                var own = true;
                var integerIndiceRegex = /^(0|[1-9][0-9]*)$/;
                do {
                    names = Object.getOwnPropertyNames(obj);
                    symbols = Object.getOwnPropertySymbols(obj);
                    for (i = 0; i < names.length; i++) {
                        props.push({
                            name: integerIndiceRegex.test(names[i]) ? Number(names[i]) : names[i],
                            desc: Object.getOwnPropertyDescriptor(obj, names[i]),
                            own: own
                        });
                    }
                    for (i = 0; i < symbols.length; i++) {
                        props.push({
                            name: symbols[i],
                            desc: Object.getOwnPropertyDescriptor(obj, symbols[i]),
                            own: own
                        });
                    }
                    if (key_mode === 1 /* napi_key_collection_mode.napi_key_own_only */) {
                        break;
                    }
                    obj = Object.getPrototypeOf(obj);
                    own = false;
                } while (obj);
                var ret = [];
                var addName = function (ret, name, key_filter, conversion_mode) {
                    if (ret.indexOf(name) !== -1)
                        return;
                    if (conversion_mode === 0 /* napi_key_conversion.napi_key_keep_numbers */) {
                        ret.push(name);
                    }
                    else if (conversion_mode === 1 /* napi_key_conversion.napi_key_numbers_to_strings */) {
                        var realName = typeof name === 'number' ? String(name) : name;
                        if (typeof realName === 'string') {
                            if (!(key_filter & 8 /* napi_key_filter.napi_key_skip_strings */)) {
                                ret.push(realName);
                            }
                        }
                        else {
                            ret.push(realName);
                        }
                    }
                };
                for (i = 0; i < props.length; i++) {
                    var prop = props[i];
                    var name_1 = prop.name;
                    var desc = prop.desc;
                    if (key_filter === 0 /* napi_key_filter.napi_key_all_properties */) {
                        addName(ret, name_1, key_filter, key_conversion);
                    }
                    else {
                        if (key_filter & 8 /* napi_key_filter.napi_key_skip_strings */ && typeof name_1 === 'string') {
                            continue;
                        }
                        if (key_filter & 16 /* napi_key_filter.napi_key_skip_symbols */ && typeof name_1 === 'symbol') {
                            continue;
                        }
                        var shouldAdd = true;
                        switch (key_filter & 7) {
                            case 1 /* napi_key_filter.napi_key_writable */: {
                                shouldAdd = Boolean(desc.writable);
                                break;
                            }
                            case 2 /* napi_key_filter.napi_key_enumerable */: {
                                shouldAdd = Boolean(desc.enumerable);
                                break;
                            }
                            case (1 /* napi_key_filter.napi_key_writable */ | 2 /* napi_key_filter.napi_key_enumerable */): {
                                shouldAdd = Boolean(desc.writable && desc.enumerable);
                                break;
                            }
                            case 4 /* napi_key_filter.napi_key_configurable */: {
                                shouldAdd = Boolean(desc.configurable);
                                break;
                            }
                            case (4 /* napi_key_filter.napi_key_configurable */ | 1 /* napi_key_filter.napi_key_writable */): {
                                shouldAdd = Boolean(desc.configurable && desc.writable);
                                break;
                            }
                            case (4 /* napi_key_filter.napi_key_configurable */ | 2 /* napi_key_filter.napi_key_enumerable */): {
                                shouldAdd = Boolean(desc.configurable && desc.enumerable);
                                break;
                            }
                            case (4 /* napi_key_filter.napi_key_configurable */ | 2 /* napi_key_filter.napi_key_enumerable */ | 1 /* napi_key_filter.napi_key_writable */): {
                                shouldAdd = Boolean(desc.configurable && desc.enumerable && desc.writable);
                                break;
                            }
                        }
                        if (shouldAdd) {
                            addName(ret, name_1, key_filter, key_conversion);
                        }
                    }
                }
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                value = emnapiCtx.addToCurrentScope(ret).id;
                var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
                HEAP_DATA_VIEW.setInt32(result, value, true);
                return envObject.getReturnStatus();
            }
            catch (err) {
                envObject.tryCatch.setError(err);
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            }
        }
        /** @__sig ippp */
        function napi_get_property_names(env, object, result) {
            return napi_get_all_property_names(env, object, 0 /* napi_key_collection_mode.napi_key_include_prototypes */, 2 /* napi_key_filter.napi_key_enumerable */ | 16 /* napi_key_filter.napi_key_skip_symbols */, 1 /* napi_key_conversion.napi_key_numbers_to_strings */, result);
        }
        /** @__sig ipppp */
        function napi_set_property(env, object, key, value) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!envObject.tryCatch.isEmpty())
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            if (!envObject.canCallIntoJs())
                return envObject.setLastError(envObject.moduleApiVersion === 2147483647 /* Version.NAPI_VERSION_EXPERIMENTAL */ ? 23 /* napi_status.napi_cannot_run_js */ : 10 /* napi_status.napi_pending_exception */);
            envObject.clearLastError();
            try {
                if (!key)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                if (!value)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                if (!object)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                var h = emnapiCtx.handleStore.get(object);
                if (!(h.isObject() || h.isFunction())) {
                    return envObject.setLastError(2 /* napi_status.napi_object_expected */);
                }
                h.value[emnapiCtx.handleStore.get(key).value] = emnapiCtx.handleStore.get(value).value;
                return envObject.getReturnStatus();
            }
            catch (err) {
                envObject.tryCatch.setError(err);
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            }
        }
        /** @__sig ipppp */
        function napi_has_property(env, object, key, result) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var r;
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!envObject.tryCatch.isEmpty())
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            if (!envObject.canCallIntoJs())
                return envObject.setLastError(envObject.moduleApiVersion === 2147483647 /* Version.NAPI_VERSION_EXPERIMENTAL */ ? 23 /* napi_status.napi_cannot_run_js */ : 10 /* napi_status.napi_pending_exception */);
            envObject.clearLastError();
            try {
                if (!key)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                if (!result)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                if (!object)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                var h = emnapiCtx.handleStore.get(object);
                if (h.value == null) {
                    throw new TypeError('Cannot convert undefined or null to object');
                }
                var v = void 0;
                try {
                    v = h.isObject() || h.isFunction() ? h.value : Object(h.value);
                }
                catch (_) {
                    return envObject.setLastError(2 /* napi_status.napi_object_expected */);
                }
                r = (emnapiCtx.handleStore.get(key).value in v) ? 1 : 0;
                var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
                HEAP_DATA_VIEW.setInt8(result, r, true);
                return envObject.getReturnStatus();
            }
            catch (err) {
                envObject.tryCatch.setError(err);
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            }
        }
        /** @__sig ipppp */
        function napi_get_property(env, object, key, result) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var value;
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!envObject.tryCatch.isEmpty())
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            if (!envObject.canCallIntoJs())
                return envObject.setLastError(envObject.moduleApiVersion === 2147483647 /* Version.NAPI_VERSION_EXPERIMENTAL */ ? 23 /* napi_status.napi_cannot_run_js */ : 10 /* napi_status.napi_pending_exception */);
            envObject.clearLastError();
            try {
                if (!key)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                if (!result)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                if (!object)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                var h = emnapiCtx.handleStore.get(object);
                if (h.value == null) {
                    throw new TypeError('Cannot convert undefined or null to object');
                }
                var v = void 0;
                try {
                    v = h.isObject() || h.isFunction() ? h.value : Object(h.value);
                }
                catch (_) {
                    return envObject.setLastError(2 /* napi_status.napi_object_expected */);
                }
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                value = envObject.ensureHandleId(v[emnapiCtx.handleStore.get(key).value]);
                var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
                HEAP_DATA_VIEW.setInt32(result, value, true);
                return envObject.getReturnStatus();
            }
            catch (err) {
                envObject.tryCatch.setError(err);
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            }
        }
        /** @__sig ipppp */
        function napi_delete_property(env, object, key, result) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var r;
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!envObject.tryCatch.isEmpty())
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            if (!envObject.canCallIntoJs())
                return envObject.setLastError(envObject.moduleApiVersion === 2147483647 /* Version.NAPI_VERSION_EXPERIMENTAL */ ? 23 /* napi_status.napi_cannot_run_js */ : 10 /* napi_status.napi_pending_exception */);
            envObject.clearLastError();
            try {
                if (!key)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                if (!object)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                var h = emnapiCtx.handleStore.get(object);
                if (!(h.isObject() || h.isFunction())) {
                    return envObject.setLastError(2 /* napi_status.napi_object_expected */);
                }
                var propertyKey = emnapiCtx.handleStore.get(key).value;
                if (emnapiCtx.feature.supportReflect) {
                    r = Reflect.deleteProperty(h.value, propertyKey);
                }
                else {
                    try {
                        r = delete h.value[propertyKey];
                    }
                    catch (_) {
                        r = false;
                    }
                }
                if (result) {
                    var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
                    HEAP_DATA_VIEW.setInt8(result, r ? 1 : 0, true);
                }
                return envObject.getReturnStatus();
            }
            catch (err) {
                envObject.tryCatch.setError(err);
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            }
        }
        /** @__sig ipppp */
        function napi_has_own_property(env, object, key, result) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var r;
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!envObject.tryCatch.isEmpty())
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            if (!envObject.canCallIntoJs())
                return envObject.setLastError(envObject.moduleApiVersion === 2147483647 /* Version.NAPI_VERSION_EXPERIMENTAL */ ? 23 /* napi_status.napi_cannot_run_js */ : 10 /* napi_status.napi_pending_exception */);
            envObject.clearLastError();
            try {
                if (!key)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                if (!result)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                if (!object)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                var h = emnapiCtx.handleStore.get(object);
                if (h.value == null) {
                    throw new TypeError('Cannot convert undefined or null to object');
                }
                var v = void 0;
                try {
                    v = h.isObject() || h.isFunction() ? h.value : Object(h.value);
                }
                catch (_) {
                    return envObject.setLastError(2 /* napi_status.napi_object_expected */);
                }
                var prop = emnapiCtx.handleStore.get(key).value;
                if (typeof prop !== 'string' && typeof prop !== 'symbol') {
                    return envObject.setLastError(4 /* napi_status.napi_name_expected */);
                }
                r = Object.prototype.hasOwnProperty.call(v, emnapiCtx.handleStore.get(key).value);
                var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
                HEAP_DATA_VIEW.setInt8(result, r ? 1 : 0, true);
                return envObject.getReturnStatus();
            }
            catch (err) {
                envObject.tryCatch.setError(err);
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            }
        }
        /** @__sig ipppp */
        function napi_set_named_property(env, object, cname, value) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!envObject.tryCatch.isEmpty())
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            if (!envObject.canCallIntoJs())
                return envObject.setLastError(envObject.moduleApiVersion === 2147483647 /* Version.NAPI_VERSION_EXPERIMENTAL */ ? 23 /* napi_status.napi_cannot_run_js */ : 10 /* napi_status.napi_pending_exception */);
            envObject.clearLastError();
            try {
                if (!value)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                if (!object)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                var h = emnapiCtx.handleStore.get(object);
                if (!(h.isObject() || h.isFunction())) {
                    return envObject.setLastError(2 /* napi_status.napi_object_expected */);
                }
                if (!cname) {
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                }
                emnapiCtx.handleStore.get(object).value[emnapiString.UTF8ToString(cname, -1)] = emnapiCtx.handleStore.get(value).value;
                return envObject.getReturnStatus();
            }
            catch (err) {
                envObject.tryCatch.setError(err);
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            }
        }
        /** @__sig ipppp */
        function napi_has_named_property(env, object, utf8name, result) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var r;
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!envObject.tryCatch.isEmpty())
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            if (!envObject.canCallIntoJs())
                return envObject.setLastError(envObject.moduleApiVersion === 2147483647 /* Version.NAPI_VERSION_EXPERIMENTAL */ ? 23 /* napi_status.napi_cannot_run_js */ : 10 /* napi_status.napi_pending_exception */);
            envObject.clearLastError();
            try {
                if (!result)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                if (!object)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                if (!utf8name) {
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                }
                var h = emnapiCtx.handleStore.get(object);
                if (h.value == null) {
                    throw new TypeError('Cannot convert undefined or null to object');
                }
                var v = void 0;
                try {
                    v = h.isObject() || h.isFunction() ? h.value : Object(h.value);
                }
                catch (_) {
                    return envObject.setLastError(2 /* napi_status.napi_object_expected */);
                }
                r = emnapiString.UTF8ToString(utf8name, -1) in v;
                var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
                HEAP_DATA_VIEW.setInt8(result, r ? 1 : 0, true);
                return envObject.getReturnStatus();
            }
            catch (err) {
                envObject.tryCatch.setError(err);
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            }
        }
        /** @__sig ipppp */
        function napi_get_named_property(env, object, utf8name, result) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var value;
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!envObject.tryCatch.isEmpty())
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            if (!envObject.canCallIntoJs())
                return envObject.setLastError(envObject.moduleApiVersion === 2147483647 /* Version.NAPI_VERSION_EXPERIMENTAL */ ? 23 /* napi_status.napi_cannot_run_js */ : 10 /* napi_status.napi_pending_exception */);
            envObject.clearLastError();
            try {
                if (!result)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                if (!object)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                if (!utf8name) {
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                }
                var h = emnapiCtx.handleStore.get(object);
                if (h.value == null) {
                    throw new TypeError('Cannot convert undefined or null to object');
                }
                var v = void 0;
                try {
                    v = h.isObject() || h.isFunction() ? h.value : Object(h.value);
                }
                catch (_) {
                    return envObject.setLastError(2 /* napi_status.napi_object_expected */);
                }
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                value = envObject.ensureHandleId(v[emnapiString.UTF8ToString(utf8name, -1)]);
                var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
                HEAP_DATA_VIEW.setInt32(result, value, true);
                return envObject.getReturnStatus();
            }
            catch (err) {
                envObject.tryCatch.setError(err);
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            }
        }
        /** @__sig ippip */
        function napi_set_element(env, object, index, value) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!envObject.tryCatch.isEmpty())
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            if (!envObject.canCallIntoJs())
                return envObject.setLastError(envObject.moduleApiVersion === 2147483647 /* Version.NAPI_VERSION_EXPERIMENTAL */ ? 23 /* napi_status.napi_cannot_run_js */ : 10 /* napi_status.napi_pending_exception */);
            envObject.clearLastError();
            try {
                if (!value)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                if (!object)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                var h = emnapiCtx.handleStore.get(object);
                if (!(h.isObject() || h.isFunction())) {
                    return envObject.setLastError(2 /* napi_status.napi_object_expected */);
                }
                h.value[index >>> 0] = emnapiCtx.handleStore.get(value).value;
                return envObject.getReturnStatus();
            }
            catch (err) {
                envObject.tryCatch.setError(err);
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            }
        }
        /** @__sig ippip */
        function napi_has_element(env, object, index, result) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var r;
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!envObject.tryCatch.isEmpty())
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            if (!envObject.canCallIntoJs())
                return envObject.setLastError(envObject.moduleApiVersion === 2147483647 /* Version.NAPI_VERSION_EXPERIMENTAL */ ? 23 /* napi_status.napi_cannot_run_js */ : 10 /* napi_status.napi_pending_exception */);
            envObject.clearLastError();
            try {
                if (!result)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                if (!object)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                var h = emnapiCtx.handleStore.get(object);
                if (h.value == null) {
                    throw new TypeError('Cannot convert undefined or null to object');
                }
                var v = void 0;
                try {
                    v = h.isObject() || h.isFunction() ? h.value : Object(h.value);
                }
                catch (_) {
                    return envObject.setLastError(2 /* napi_status.napi_object_expected */);
                }
                r = ((index >>> 0) in v) ? 1 : 0;
                var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
                HEAP_DATA_VIEW.setInt8(result, r, true);
                return envObject.getReturnStatus();
            }
            catch (err) {
                envObject.tryCatch.setError(err);
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            }
        }
        /** @__sig ippip */
        function napi_get_element(env, object, index, result) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var value;
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!envObject.tryCatch.isEmpty())
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            if (!envObject.canCallIntoJs())
                return envObject.setLastError(envObject.moduleApiVersion === 2147483647 /* Version.NAPI_VERSION_EXPERIMENTAL */ ? 23 /* napi_status.napi_cannot_run_js */ : 10 /* napi_status.napi_pending_exception */);
            envObject.clearLastError();
            try {
                if (!result)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                if (!object)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                var h = emnapiCtx.handleStore.get(object);
                if (h.value == null) {
                    throw new TypeError('Cannot convert undefined or null to object');
                }
                var v = void 0;
                try {
                    v = h.isObject() || h.isFunction() ? h.value : Object(h.value);
                }
                catch (_) {
                    return envObject.setLastError(2 /* napi_status.napi_object_expected */);
                }
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                value = envObject.ensureHandleId(v[index >>> 0]);
                var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
                HEAP_DATA_VIEW.setInt32(result, value, true);
                return envObject.getReturnStatus();
            }
            catch (err) {
                envObject.tryCatch.setError(err);
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            }
        }
        /** @__sig ippip */
        function napi_delete_element(env, object, index, result) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var r;
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!envObject.tryCatch.isEmpty())
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            if (!envObject.canCallIntoJs())
                return envObject.setLastError(envObject.moduleApiVersion === 2147483647 /* Version.NAPI_VERSION_EXPERIMENTAL */ ? 23 /* napi_status.napi_cannot_run_js */ : 10 /* napi_status.napi_pending_exception */);
            envObject.clearLastError();
            try {
                if (!object)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                var h = emnapiCtx.handleStore.get(object);
                if (!(h.isObject() || h.isFunction())) {
                    return envObject.setLastError(2 /* napi_status.napi_object_expected */);
                }
                if (emnapiCtx.feature.supportReflect) {
                    r = Reflect.deleteProperty(h.value, index >>> 0);
                }
                else {
                    try {
                        r = delete h.value[index >>> 0];
                    }
                    catch (_) {
                        r = false;
                    }
                }
                if (result) {
                    var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
                    HEAP_DATA_VIEW.setInt8(result, r ? 1 : 0, true);
                }
                return envObject.getReturnStatus();
            }
            catch (err) {
                envObject.tryCatch.setError(err);
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            }
        }
        /** @__sig ipppp */
        function napi_define_properties(env, object, property_count, properties) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var propPtr, attributes;
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!envObject.tryCatch.isEmpty())
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            if (!envObject.canCallIntoJs())
                return envObject.setLastError(envObject.moduleApiVersion === 2147483647 /* Version.NAPI_VERSION_EXPERIMENTAL */ ? 23 /* napi_status.napi_cannot_run_js */ : 10 /* napi_status.napi_pending_exception */);
            envObject.clearLastError();
            try {
                property_count = property_count >>> 0;
                if (property_count > 0) {
                    if (!properties)
                        return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                }
                if (!object)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                var h = emnapiCtx.handleStore.get(object);
                var maybeObject = h.value;
                if (!(h.isObject() || h.isFunction())) {
                    return envObject.setLastError(2 /* napi_status.napi_object_expected */);
                }
                var propertyName = void 0;
                var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
                for (var i = 0; i < property_count; i++) {
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    propPtr = properties + (i * (4 * 8));
                    var utf8Name = HEAP_DATA_VIEW.getInt32(propPtr, true);
                    var name_2 = HEAP_DATA_VIEW.getInt32(propPtr + 4, true);
                    var method = HEAP_DATA_VIEW.getInt32(propPtr + 8, true);
                    var getter = HEAP_DATA_VIEW.getInt32(propPtr + 12, true);
                    var setter = HEAP_DATA_VIEW.getInt32(propPtr + 16, true);
                    var value = HEAP_DATA_VIEW.getInt32(propPtr + 20, true);
                    attributes = HEAP_DATA_VIEW.getInt32(propPtr + 24, true);
                    var data = HEAP_DATA_VIEW.getInt32(propPtr + 28, true);
                    if (utf8Name) {
                        propertyName = emnapiString.UTF8ToString(utf8Name, -1);
                    }
                    else {
                        if (!name_2) {
                            return envObject.setLastError(4 /* napi_status.napi_name_expected */);
                        }
                        propertyName = emnapiCtx.handleStore.get(name_2).value;
                        if (typeof propertyName !== 'string' && typeof propertyName !== 'symbol') {
                            return envObject.setLastError(4 /* napi_status.napi_name_expected */);
                        }
                    }
                    emnapiDefineProperty(envObject, maybeObject, propertyName, method, getter, setter, value, attributes, data);
                }
                return envObject.getReturnStatus();
            }
            catch (err) {
                envObject.tryCatch.setError(err);
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            }
        }
        /** @__sig ipp */
        function napi_object_freeze(env, object) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!envObject.tryCatch.isEmpty())
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            if (!envObject.canCallIntoJs())
                return envObject.setLastError(envObject.moduleApiVersion === 2147483647 /* Version.NAPI_VERSION_EXPERIMENTAL */ ? 23 /* napi_status.napi_cannot_run_js */ : 10 /* napi_status.napi_pending_exception */);
            envObject.clearLastError();
            try {
                if (!object)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                var h = emnapiCtx.handleStore.get(object);
                var maybeObject = h.value;
                if (!(h.isObject() || h.isFunction())) {
                    return envObject.setLastError(2 /* napi_status.napi_object_expected */);
                }
                Object.freeze(maybeObject);
                return envObject.getReturnStatus();
            }
            catch (err) {
                envObject.tryCatch.setError(err);
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            }
        }
        /** @__sig ipp */
        function napi_object_seal(env, object) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!envObject.tryCatch.isEmpty())
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            if (!envObject.canCallIntoJs())
                return envObject.setLastError(envObject.moduleApiVersion === 2147483647 /* Version.NAPI_VERSION_EXPERIMENTAL */ ? 23 /* napi_status.napi_cannot_run_js */ : 10 /* napi_status.napi_pending_exception */);
            envObject.clearLastError();
            try {
                if (!object)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                var h = emnapiCtx.handleStore.get(object);
                var maybeObject = h.value;
                if (!(h.isObject() || h.isFunction())) {
                    return envObject.setLastError(2 /* napi_status.napi_object_expected */);
                }
                Object.seal(maybeObject);
                return envObject.getReturnStatus();
            }
            catch (err) {
                envObject.tryCatch.setError(err);
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            }
        }
        var propertyMod = /*#__PURE__*/ Object.freeze({
            __proto__: null,
            napi_define_properties: napi_define_properties,
            napi_delete_element: napi_delete_element,
            napi_delete_property: napi_delete_property,
            napi_get_all_property_names: napi_get_all_property_names,
            napi_get_element: napi_get_element,
            napi_get_named_property: napi_get_named_property,
            napi_get_property: napi_get_property,
            napi_get_property_names: napi_get_property_names,
            napi_has_element: napi_has_element,
            napi_has_named_property: napi_has_named_property,
            napi_has_own_property: napi_has_own_property,
            napi_has_property: napi_has_property,
            napi_object_freeze: napi_object_freeze,
            napi_object_seal: napi_object_seal,
            napi_set_element: napi_set_element,
            napi_set_named_property: napi_set_named_property,
            napi_set_property: napi_set_property
        });
        /** @__sig ippp */
        function napi_run_script(env, script, result) {
            var status;
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var value;
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!envObject.tryCatch.isEmpty())
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            if (!envObject.canCallIntoJs())
                return envObject.setLastError(envObject.moduleApiVersion === 2147483647 /* Version.NAPI_VERSION_EXPERIMENTAL */ ? 23 /* napi_status.napi_cannot_run_js */ : 10 /* napi_status.napi_pending_exception */);
            envObject.clearLastError();
            try {
                if (!script)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                if (!result)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                var v8Script = emnapiCtx.handleStore.get(script);
                if (!v8Script.isString()) {
                    return envObject.setLastError(3 /* napi_status.napi_string_expected */);
                }
                var g = emnapiCtx.handleStore.get(5 /* GlobalHandle.GLOBAL */).value;
                var ret = g.eval(v8Script.value);
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                value = envObject.ensureHandleId(ret);
                var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
                HEAP_DATA_VIEW.setInt32(result, value, true);
                status = envObject.getReturnStatus();
            }
            catch (err) {
                envObject.tryCatch.setError(err);
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            }
            return status;
        }
        var scriptMod = /*#__PURE__*/ Object.freeze({
            __proto__: null,
            napi_run_script: napi_run_script
        });
        /** @__sig ippp */
        function napi_typeof(env, value, result) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!value)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            if (!result)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            var v = emnapiCtx.handleStore.get(value);
            var r;
            if (v.isNumber()) {
                r = 3 /* napi_valuetype.napi_number */;
            }
            else if (v.isBigInt()) {
                r = 9 /* napi_valuetype.napi_bigint */;
            }
            else if (v.isString()) {
                r = 4 /* napi_valuetype.napi_string */;
            }
            else if (v.isFunction()) {
                // This test has to come before IsObject because IsFunction
                // implies IsObject
                r = 7 /* napi_valuetype.napi_function */;
            }
            else if (v.isExternal()) {
                // This test has to come before IsObject because IsExternal
                // implies IsObject
                r = 8 /* napi_valuetype.napi_external */;
            }
            else if (v.isObject()) {
                r = 6 /* napi_valuetype.napi_object */;
            }
            else if (v.isBoolean()) {
                r = 2 /* napi_valuetype.napi_boolean */;
            }
            else if (v.isUndefined()) {
                r = 0 /* napi_valuetype.napi_undefined */;
            }
            else if (v.isSymbol()) {
                r = 5 /* napi_valuetype.napi_symbol */;
            }
            else if (v.isNull()) {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                r = 1 /* napi_valuetype.napi_null */;
            }
            else {
                // Should not get here unless V8 has added some new kind of value.
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            }
            var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
            HEAP_DATA_VIEW.setInt32(result, r, true);
            return envObject.clearLastError();
        }
        /** @__sig ippp */
        function napi_coerce_to_bool(env, value, result) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var v;
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!envObject.tryCatch.isEmpty())
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            if (!envObject.canCallIntoJs())
                return envObject.setLastError(envObject.moduleApiVersion === 2147483647 /* Version.NAPI_VERSION_EXPERIMENTAL */ ? 23 /* napi_status.napi_cannot_run_js */ : 10 /* napi_status.napi_pending_exception */);
            envObject.clearLastError();
            try {
                if (!value)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                if (!result)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                var handle = emnapiCtx.handleStore.get(value);
                v = handle.value ? 4 /* GlobalHandle.TRUE */ : 3 /* GlobalHandle.FALSE */;
                var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
                HEAP_DATA_VIEW.setInt32(result, v, true);
                return envObject.getReturnStatus();
            }
            catch (err) {
                envObject.tryCatch.setError(err);
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            }
        }
        /** @__sig ippp */
        function napi_coerce_to_number(env, value, result) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var v;
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!envObject.tryCatch.isEmpty())
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            if (!envObject.canCallIntoJs())
                return envObject.setLastError(envObject.moduleApiVersion === 2147483647 /* Version.NAPI_VERSION_EXPERIMENTAL */ ? 23 /* napi_status.napi_cannot_run_js */ : 10 /* napi_status.napi_pending_exception */);
            envObject.clearLastError();
            try {
                if (!value)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                if (!result)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                var handle = emnapiCtx.handleStore.get(value);
                if (handle.isBigInt()) {
                    throw new TypeError('Cannot convert a BigInt value to a number');
                }
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                v = emnapiCtx.addToCurrentScope(Number(handle.value)).id;
                var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
                HEAP_DATA_VIEW.setInt32(result, v, true);
                return envObject.getReturnStatus();
            }
            catch (err) {
                envObject.tryCatch.setError(err);
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            }
        }
        /** @__sig ippp */
        function napi_coerce_to_object(env, value, result) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var v;
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!envObject.tryCatch.isEmpty())
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            if (!envObject.canCallIntoJs())
                return envObject.setLastError(envObject.moduleApiVersion === 2147483647 /* Version.NAPI_VERSION_EXPERIMENTAL */ ? 23 /* napi_status.napi_cannot_run_js */ : 10 /* napi_status.napi_pending_exception */);
            envObject.clearLastError();
            try {
                if (!value)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                if (!result)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                var handle = emnapiCtx.handleStore.get(value);
                if (handle.value == null) {
                    throw new TypeError('Cannot convert undefined or null to object');
                }
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                v = envObject.ensureHandleId(Object(handle.value));
                var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
                HEAP_DATA_VIEW.setInt32(result, v, true);
                return envObject.getReturnStatus();
            }
            catch (err) {
                envObject.tryCatch.setError(err);
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            }
        }
        /** @__sig ippp */
        function napi_coerce_to_string(env, value, result) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var v;
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!envObject.tryCatch.isEmpty())
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            if (!envObject.canCallIntoJs())
                return envObject.setLastError(envObject.moduleApiVersion === 2147483647 /* Version.NAPI_VERSION_EXPERIMENTAL */ ? 23 /* napi_status.napi_cannot_run_js */ : 10 /* napi_status.napi_pending_exception */);
            envObject.clearLastError();
            try {
                if (!value)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                if (!result)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                var handle = emnapiCtx.handleStore.get(value);
                if (handle.isSymbol()) {
                    throw new TypeError('Cannot convert a Symbol value to a string');
                }
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                v = emnapiCtx.addToCurrentScope(String(handle.value)).id;
                var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
                HEAP_DATA_VIEW.setInt32(result, v, true);
                return envObject.getReturnStatus();
            }
            catch (err) {
                envObject.tryCatch.setError(err);
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            }
        }
        /** @__sig ipppp */
        function napi_instanceof(env, object, constructor, result) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var r;
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!envObject.tryCatch.isEmpty())
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            if (!envObject.canCallIntoJs())
                return envObject.setLastError(envObject.moduleApiVersion === 2147483647 /* Version.NAPI_VERSION_EXPERIMENTAL */ ? 23 /* napi_status.napi_cannot_run_js */ : 10 /* napi_status.napi_pending_exception */);
            envObject.clearLastError();
            try {
                if (!object)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                if (!result)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                if (!constructor)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
                HEAP_DATA_VIEW.setInt8(result, 0, true);
                var ctor = emnapiCtx.handleStore.get(constructor);
                if (!ctor.isFunction()) {
                    return envObject.setLastError(5 /* napi_status.napi_function_expected */);
                }
                var val = emnapiCtx.handleStore.get(object).value;
                var ret = val instanceof ctor.value;
                r = ret ? 1 : 0;
                HEAP_DATA_VIEW.setInt8(result, r, true);
                return envObject.getReturnStatus();
            }
            catch (err) {
                envObject.tryCatch.setError(err);
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            }
        }
        /** @__sig ippp */
        function napi_is_array(env, value, result) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!value)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            if (!result)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            var h = emnapiCtx.handleStore.get(value);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var r = h.isArray() ? 1 : 0;
            var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
            HEAP_DATA_VIEW.setInt8(result, r, true);
            return envObject.clearLastError();
        }
        /** @__sig ippp */
        function napi_is_arraybuffer(env, value, result) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!value)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            if (!result)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            var h = emnapiCtx.handleStore.get(value);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var r = h.isArrayBuffer() ? 1 : 0;
            var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
            HEAP_DATA_VIEW.setInt8(result, r, true);
            return envObject.clearLastError();
        }
        /** @__sig ippp */
        function napi_is_date(env, value, result) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!value)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            if (!result)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            var h = emnapiCtx.handleStore.get(value);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var r = h.isDate() ? 1 : 0;
            var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
            HEAP_DATA_VIEW.setInt8(result, r, true);
            return envObject.clearLastError();
        }
        /** @__sig ippp */
        function napi_is_error(env, value, result) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!value)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            if (!result)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            var val = emnapiCtx.handleStore.get(value).value;
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var r = (val instanceof Error) ? 1 : 0;
            var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
            HEAP_DATA_VIEW.setInt8(result, r, true);
            return envObject.clearLastError();
        }
        /** @__sig ippp */
        function napi_is_typedarray(env, value, result) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!value)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            if (!result)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            var h = emnapiCtx.handleStore.get(value);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var r = h.isTypedArray() ? 1 : 0;
            var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
            HEAP_DATA_VIEW.setInt8(result, r, true);
            return envObject.clearLastError();
        }
        /** @__sig ippp */
        function napi_is_buffer(env, value, result) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!value)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            if (!result)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            var h = emnapiCtx.handleStore.get(value);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var r = h.isBuffer() ? 1 : 0;
            var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
            HEAP_DATA_VIEW.setInt8(result, r, true);
            return envObject.clearLastError();
        }
        /** @__sig ippp */
        function napi_is_dataview(env, value, result) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!value)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            if (!result)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            var h = emnapiCtx.handleStore.get(value);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var r = h.isDataView() ? 1 : 0;
            var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
            HEAP_DATA_VIEW.setInt8(result, r, true);
            return envObject.clearLastError();
        }
        /** @__sig ipppp */
        function napi_strict_equals(env, lhs, rhs, result) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var r;
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!envObject.tryCatch.isEmpty())
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            if (!envObject.canCallIntoJs())
                return envObject.setLastError(envObject.moduleApiVersion === 2147483647 /* Version.NAPI_VERSION_EXPERIMENTAL */ ? 23 /* napi_status.napi_cannot_run_js */ : 10 /* napi_status.napi_pending_exception */);
            envObject.clearLastError();
            try {
                if (!lhs)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                if (!rhs)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                if (!result)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                var lv = emnapiCtx.handleStore.get(lhs).value;
                var rv = emnapiCtx.handleStore.get(rhs).value;
                r = (lv === rv) ? 1 : 0;
                var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
                HEAP_DATA_VIEW.setInt8(result, r, true);
                return envObject.getReturnStatus();
            }
            catch (err) {
                envObject.tryCatch.setError(err);
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            }
        }
        /** @__sig ipp */
        function napi_detach_arraybuffer(env, arraybuffer) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!arraybuffer)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            var value = emnapiCtx.handleStore.get(arraybuffer).value;
            if (!(value instanceof ArrayBuffer)) {
                if (typeof SharedArrayBuffer === 'function' && (value instanceof SharedArrayBuffer)) {
                    return envObject.setLastError(20 /* napi_status.napi_detachable_arraybuffer_expected */);
                }
                return envObject.setLastError(19 /* napi_status.napi_arraybuffer_expected */);
            }
            try {
                var MessageChannel_1 = emnapiCtx.feature.MessageChannel;
                var messageChannel = new MessageChannel_1();
                messageChannel.port1.postMessage(value, [value]);
            }
            catch (_) {
                return envObject.setLastError(9 /* napi_status.napi_generic_failure */);
            }
            return envObject.clearLastError();
        }
        /** @__sig ippp */
        function napi_is_detached_arraybuffer(env, arraybuffer, result) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            // @ts-expect-error
            var envObject = emnapiCtx.envStore.get(env);
            envObject.checkGCAccess();
            if (!envObject.tryCatch.isEmpty())
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            if (!envObject.canCallIntoJs())
                return envObject.setLastError(envObject.moduleApiVersion === 2147483647 /* Version.NAPI_VERSION_EXPERIMENTAL */ ? 23 /* napi_status.napi_cannot_run_js */ : 10 /* napi_status.napi_pending_exception */);
            envObject.clearLastError();
            try {
                if (!arraybuffer)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                if (!result)
                    return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
                var h = emnapiCtx.handleStore.get(arraybuffer);
                var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
                if (h.isArrayBuffer() && h.value.byteLength === 0) {
                    try {
                        // eslint-disable-next-line no-new
                        new Uint8Array(h.value);
                    }
                    catch (_) {
                        HEAP_DATA_VIEW.setInt8(result, 1, true);
                        return envObject.getReturnStatus();
                    }
                }
                HEAP_DATA_VIEW.setInt8(result, 0, true);
                return envObject.getReturnStatus();
            }
            catch (err) {
                envObject.tryCatch.setError(err);
                return envObject.setLastError(10 /* napi_status.napi_pending_exception */);
            }
        }
        var valueOperationMod = /*#__PURE__*/ Object.freeze({
            __proto__: null,
            napi_coerce_to_bool: napi_coerce_to_bool,
            napi_coerce_to_number: napi_coerce_to_number,
            napi_coerce_to_object: napi_coerce_to_object,
            napi_coerce_to_string: napi_coerce_to_string,
            napi_detach_arraybuffer: napi_detach_arraybuffer,
            napi_instanceof: napi_instanceof,
            napi_is_array: napi_is_array,
            napi_is_arraybuffer: napi_is_arraybuffer,
            napi_is_buffer: napi_is_buffer,
            napi_is_dataview: napi_is_dataview,
            napi_is_date: napi_is_date,
            napi_is_detached_arraybuffer: napi_is_detached_arraybuffer,
            napi_is_error: napi_is_error,
            napi_is_typedarray: napi_is_typedarray,
            napi_strict_equals: napi_strict_equals,
            napi_typeof: napi_typeof
        });
        /** @__sig ipp */
        function napi_get_version(env, result) {
            if (!env)
                return 1 /* napi_status.napi_invalid_arg */;
            var envObject = emnapiCtx.envStore.get(env);
            if (!result)
                return envObject.setLastError(1 /* napi_status.napi_invalid_arg */);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var NODE_API_SUPPORTED_VERSION_MAX = 9 /* Version.NODE_API_SUPPORTED_VERSION_MAX */;
            var HEAP_DATA_VIEW = new DataView(wasmMemory.buffer);
            HEAP_DATA_VIEW.setUint32(result, NODE_API_SUPPORTED_VERSION_MAX, true);
            return envObject.clearLastError();
        }
        var versionMod = /*#__PURE__*/ Object.freeze({
            __proto__: null,
            napi_get_version: napi_get_version
        });
        emnapiAWST.init();
        emnapiExternalMemory.init();
        emnapiString.init();
        emnapiTSFN.init();
        napiModule.emnapi.syncMemory = $emnapiSyncMemory;
        napiModule.emnapi.getMemoryAddress = $emnapiGetMemoryAddress;
        function addImports(mod) {
            var keys = Object.keys(mod);
            for (var i = 0; i < keys.length; ++i) {
                var k = keys[i];
                if (k.indexOf('$') === 0)
                    continue;
                if (k.indexOf('emnapi_') === 0) {
                    napiModule.imports.emnapi[k] = mod[k];
                }
                else if (k.indexOf('_emnapi_') === 0 || k === 'napi_set_last_error' || k === 'napi_clear_last_error') {
                    napiModule.imports.env[k] = mod[k];
                }
                else {
                    napiModule.imports.napi[k] = mod[k];
                }
            }
        }
        addImports(asyncMod);
        addImports(memoryMod);
        addImports(asyncWorkMod);
        addImports(utilMod);
        addImports(convert2cMod);
        addImports(convert2napiMod);
        addImports(createMod);
        addImports(globalMod);
        addImports(wrapMod);
        addImports(envMod);
        addImports(emnapiMod);
        addImports(errorMod);
        addImports(functionMod);
        addImports(lifeMod);
        addImports(miscellaneousMod);
        addImports(nodeMod);
        addImports(promiseMod);
        addImports(propertyMod);
        addImports(scriptMod);
        addImports(valueOperationMod);
        addImports(versionMod);
        napiModule.imports.napi.napi_create_threadsafe_function = napi_create_threadsafe_function;
        napiModule.imports.napi.napi_get_threadsafe_function_context = napi_get_threadsafe_function_context;
        napiModule.imports.napi.napi_call_threadsafe_function = napi_call_threadsafe_function;
        napiModule.imports.napi.napi_acquire_threadsafe_function = napi_acquire_threadsafe_function;
        napiModule.imports.napi.napi_release_threadsafe_function = napi_release_threadsafe_function;
        napiModule.imports.napi.napi_unref_threadsafe_function = napi_unref_threadsafe_function;
        napiModule.imports.napi.napi_ref_threadsafe_function = napi_ref_threadsafe_function;
        return napiModule;
    })();
    return napiModule;
}

function loadNapiModuleImpl(loadFn, userNapiModule, wasmInput, options) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    options = options !== null && options !== void 0 ? options : {};
    var getMemory = options.getMemory;
    var getTable = options.getTable;
    var beforeInit = options.beforeInit;
    if (getMemory != null && typeof getMemory !== 'function') {
        throw new TypeError('options.getMemory is not a function');
    }
    if (getTable != null && typeof getTable !== 'function') {
        throw new TypeError('options.getTable is not a function');
    }
    if (beforeInit != null && typeof beforeInit !== 'function') {
        throw new TypeError('options.beforeInit is not a function');
    }
    var napiModule;
    {
        napiModule = createNapiModule(options);
    }
    var wasi = options.wasi;
    var importObject = {
        env: napiModule.imports.env,
        napi: napiModule.imports.napi,
        emnapi: napiModule.imports.emnapi,
        wasi: {
            // eslint-disable-next-line camelcase
            'thread-spawn': function __imported_wasi_thread_spawn(startArg, errorOrTid) {
                return napiModule.spawnThread(startArg, errorOrTid);
            }
        }
    };
    if (wasi) {
        Object.assign(importObject, typeof wasi.getImportObject === 'function'
            ? wasi.getImportObject()
            : { wasi_snapshot_preview1: wasi.wasiImport });
    }
    var overwriteImports = options.overwriteImports;
    if (typeof overwriteImports === 'function') {
        var newImportObject = overwriteImports(importObject);
        if (typeof newImportObject === 'object' && newImportObject !== null) {
            importObject = newImportObject;
        }
    }
    return loadFn(wasmInput, importObject, function (err, source) {
        if (err) {
            throw err;
        }
        var originalInstance = source.instance;
        var instance = originalInstance;
        var originalExports = originalInstance.exports;
        var exportMemory = 'memory' in originalExports;
        var importMemory = 'memory' in importObject.env;
        var memory = getMemory
            ? getMemory(originalExports)
            : exportMemory
                ? originalExports.memory
                : importMemory
                    ? importObject.env.memory
                    : undefined;
        if (!memory) {
            throw new Error('memory is neither exported nor imported');
        }
        var table = getTable ? getTable(originalExports) : originalExports.__indirect_function_table;
        if (wasi && !exportMemory) {
            var exports_1 = Object.create(null);
            Object.assign(exports_1, originalExports, { memory: memory });
            instance = { exports: exports_1 };
        }
        var module = source.module;
        if (wasi) {
            if (napiModule.childThread) {
                // https://github.com/nodejs/help/issues/4102
                var createHandler = function (target) {
                    var handlers = [
                        'apply',
                        'construct',
                        'defineProperty',
                        'deleteProperty',
                        'get',
                        'getOwnPropertyDescriptor',
                        'getPrototypeOf',
                        'has',
                        'isExtensible',
                        'ownKeys',
                        'preventExtensions',
                        'set',
                        'setPrototypeOf'
                    ];
                    var handler = {};
                    var _loop_1 = function (i) {
                        var name_1 = handlers[i];
                        handler[name_1] = function () {
                            var args = Array.prototype.slice.call(arguments, 1);
                            args.unshift(target);
                            return Reflect[name_1].apply(Reflect, args);
                        };
                    };
                    for (var i = 0; i < handlers.length; i++) {
                        _loop_1(i);
                    }
                    return handler;
                };
                var handler = createHandler(originalExports);
                var noop_1 = function () { };
                handler.get = function (_target, p, receiver) {
                    if (p === 'memory') {
                        return memory;
                    }
                    if (p === '_initialize') {
                        return noop_1;
                    }
                    return Reflect.get(originalExports, p, receiver);
                };
                var exportsProxy_1 = new Proxy(Object.create(null), handler);
                instance = new Proxy(instance, {
                    get: function (target, p, receiver) {
                        if (p === 'exports') {
                            return exportsProxy_1;
                        }
                        return Reflect.get(target, p, receiver);
                    }
                });
            }
            wasi.initialize(instance);
        }
        if (beforeInit) {
            beforeInit({
                instance: originalInstance,
                module: module
            });
        }
        napiModule.init({
            instance: instance,
            module: module,
            memory: memory,
            table: table
        });
        var ret = { instance: originalInstance, module: module };
        {
            ret.napiModule = napiModule;
        }
        return ret;
    });
}
function loadCallback(wasmInput, importObject, callback) {
    return load(wasmInput, importObject).then(function (source) {
        return callback(null, source);
    }, function (err) {
        return callback(err);
    });
}
function loadSyncCallback(wasmInput, importObject, callback) {
    var source;
    try {
        source = loadSync(wasmInput, importObject);
    }
    catch (err) {
        return callback(err);
    }
    return callback(null, source);
}
/** @public */
function instantiateNapiModule(
/** Only support `BufferSource` or `WebAssembly.Module` on Node.js */
wasmInput, options) {
    return loadNapiModuleImpl(loadCallback, undefined, wasmInput, options);
}
/** @public */
function instantiateNapiModuleSync(wasmInput, options) {
    return loadNapiModuleImpl(loadSyncCallback, undefined, wasmInput, options);
}

/** @public */
var MessageHandler = /*#__PURE__*/ (function () {
    function MessageHandler(options) {
        var onLoad = options.onLoad;
        if (typeof onLoad !== 'function') {
            throw new TypeError('options.onLoad is not a function');
        }
        this.onLoad = onLoad;
        this.instance = undefined;
        // this.module = undefined
        this.napiModule = undefined;
        this.messagesBeforeLoad = [];
    }
    MessageHandler.prototype.handle = function (e) {
        var _this = this;
        var _a;
        if ((_a = e === null || e === void 0 ? void 0 : e.data) === null || _a === void 0 ? void 0 : _a.__emnapi__) {
            var type = e.data.__emnapi__.type;
            var payload_1 = e.data.__emnapi__.payload;
            var onLoad = this.onLoad;
            if (type === 'load') {
                if (this.instance !== undefined)
                    return;
                var source = onLoad(payload_1);
                var then = source && 'then' in source ? source.then : undefined;
                if (typeof then === 'function') {
                    // eslint-disable-next-line @typescript-eslint/no-floating-promises
                    then.call(source, function (source) { onLoaded.call(_this, source); }, function (err) { throw err; });
                }
                else {
                    onLoaded.call(this, source);
                }
            }
            else if (type === 'start') {
                handleAfterLoad.call(this, e, function () {
                    _this.napiModule.startThread(payload_1.tid, payload_1.arg);
                });
            }
            else if (type === 'async-worker-init') {
                handleAfterLoad.call(this, e, function () {
                    _this.napiModule.initWorker(payload_1.arg);
                });
            }
            else if (type === 'async-work-execute') {
                handleAfterLoad.call(this, e, function () {
                    _this.napiModule.executeAsyncWork(payload_1.work);
                });
            }
        }
    };
    return MessageHandler;
}());
function handleAfterLoad(e, f) {
    if (this.instance !== undefined) {
        f.call(this, e);
    }
    else {
        this.messagesBeforeLoad.push(e.data);
    }
}
function onLoaded(source) {
    if (source == null) {
        throw new TypeError('onLoad should return an object');
    }
    var instance = source.instance;
    var napiModule = source.napiModule;
    if (!instance)
        throw new TypeError('onLoad should return an object which includes "instance"');
    if (!napiModule)
        throw new TypeError('onLoad should return an object which includes "napiModule"');
    if (!napiModule.childThread)
        throw new Error('napiModule should be created with `childThread: true`');
    this.instance = instance;
    this.napiModule = napiModule;
    var postMessage = napiModule.postMessage;
    postMessage({
        __emnapi__: {
            type: 'loaded',
            payload: {}
        }
    });
    var messages = this.messagesBeforeLoad;
    this.messagesBeforeLoad = [];
    for (var i = 0; i < messages.length; i++) {
        var data = messages[i];
        this.handle({ data: data });
    }
}

/******************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */
/* global Reflect, Promise, SuppressedError, Symbol */

var extendStatics = function(d, b) {
  extendStatics = Object.setPrototypeOf ||
      ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
      function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
  return extendStatics(d, b);
};

function __extends(d, b) {
  if (typeof b !== "function" && b !== null)
      throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
  extendStatics(d, b);
  function __() { this.constructor = d; }
  d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
}

typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
  var e = new Error(message);
  return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
};

var EMPTY_ARGS = [];
var CallbackInfo = /*#__PURE__*/ (function () {
    function CallbackInfo(id, parent, child, thiz, data, args, fn) {
        this.id = id;
        this.parent = parent;
        this.child = child;
        this.thiz = thiz;
        this.data = data;
        this.args = args;
        this.fn = fn;
    }
    CallbackInfo.prototype.getNewTarget = function (envObject) {
        var thiz = this.thiz;
        // eslint-disable-next-line @typescript-eslint/prefer-optional-chain
        if (thiz == null || thiz.constructor == null)
            return 0;
        return thiz instanceof this.fn ? envObject.ensureHandleId(thiz.constructor) : 0;
    };
    CallbackInfo.prototype.dispose = function () {
        if (this.thiz !== undefined)
            this.thiz = undefined;
        this.args = EMPTY_ARGS;
        this.fn = null;
    };
    return CallbackInfo;
}());
var ROOT_CBINFO = new CallbackInfo(0, null, null, null, 0, null, null);
var CallbackInfoStack = /*#__PURE__*/ (function () {
    function CallbackInfoStack() {
        this.current = ROOT_CBINFO;
    }
    CallbackInfoStack.prototype.get = function (id) {
        if (id === 1)
            return ROOT_CBINFO.child;
        var info = ROOT_CBINFO;
        for (var i = 0; i < id; ++i) {
            info = info.child;
            if (info === null)
                return null;
        }
        return info === ROOT_CBINFO ? null : info;
    };
    CallbackInfoStack.prototype.pop = function () {
        var current = this.current;
        if (current === ROOT_CBINFO)
            return;
        this.current = current.parent;
        current.dispose();
    };
    CallbackInfoStack.prototype.push = function (thiz, data, args, fn) {
        var info = this.current.child;
        if (info) {
            info.thiz = thiz;
            info.data = data;
            info.args = args;
            info.fn = fn;
        }
        else {
            info = new CallbackInfo(this.current.id + 1, this.current, null, thiz, data, args, fn);
            this.current.child = info;
        }
        this.current = info;
        return info.id;
    };
    CallbackInfoStack.prototype.dispose = function () {
        this.current = null;
    };
    return CallbackInfoStack;
}());

var supportNewFunction = /*#__PURE__*/ (function () {
    var f;
    try {
        f = new Function();
    }
    catch (_) {
        return false;
    }
    return typeof f === 'function';
})();
var _global = /*#__PURE__*/ (function () {
    if (typeof globalThis !== 'undefined')
        return globalThis;
    var g = (function () { return this; })();
    if (!g && supportNewFunction) {
        try {
            g = new Function('return this')();
        }
        catch (_) { }
    }
    if (!g) {
        {
            if (typeof global !== 'undefined')
                return global;
        }
        if (typeof window !== 'undefined')
            return window;
        if (typeof self !== 'undefined')
            return self;
    }
    return g;
})();
var TryCatch = /*#__PURE__*/ (function () {
    function TryCatch() {
        this._exception = undefined;
        this._caught = false;
    }
    TryCatch.prototype.isEmpty = function () {
        return !this._caught;
    };
    TryCatch.prototype.hasCaught = function () {
        return this._caught;
    };
    TryCatch.prototype.exception = function () {
        return this._exception;
    };
    TryCatch.prototype.setError = function (err) {
        this._caught = true;
        this._exception = err;
    };
    TryCatch.prototype.reset = function () {
        this._caught = false;
        this._exception = undefined;
    };
    TryCatch.prototype.extractException = function () {
        var e = this._exception;
        this.reset();
        return e;
    };
    return TryCatch;
}());
var canSetFunctionName = /*#__PURE__*/ (function () {
    var _a;
    try {
        return Boolean((_a = Object.getOwnPropertyDescriptor(Function.prototype, 'name')) === null || _a === void 0 ? void 0 : _a.configurable);
    }
    catch (_) {
        return false;
    }
})();
var supportReflect = typeof Reflect === 'object';
var supportFinalizer = (typeof FinalizationRegistry !== 'undefined') && (typeof WeakRef !== 'undefined');
var supportWeakSymbol = /*#__PURE__*/ (function () {
    try {
        // eslint-disable-next-line symbol-description
        var sym = Symbol();
        // eslint-disable-next-line no-new
        new WeakRef(sym);
        new WeakMap().set(sym, undefined);
    }
    catch (_) {
        return false;
    }
    return true;
})();
var supportBigInt = typeof BigInt !== 'undefined';
function isReferenceType(v) {
    return (typeof v === 'object' && v !== null) || typeof v === 'function';
}
var _require = /*#__PURE__*/ (function () {
    var nativeRequire;
    {
        nativeRequire = (function () {
            return (typeof require !== 'undefined' ? require : undefined);
        })();
    }
    return nativeRequire;
})();
var _MessageChannel = typeof MessageChannel === 'function'
    ? MessageChannel
    : /*#__PURE__*/ (function () {
        try {
            return _require('worker_threads').MessageChannel;
        }
        catch (_) { }
        return undefined;
    })();
var _setImmediate = typeof setImmediate === 'function'
    ? setImmediate
    : function (callback) {
        if (typeof callback !== 'function') {
            throw new TypeError('The "callback" argument must be of type function');
        }
        if (_MessageChannel) {
            var channel_1 = new _MessageChannel();
            channel_1.port1.onmessage = function () {
                channel_1.port1.onmessage = null;
                channel_1 = undefined;
                callback();
            };
            channel_1.port2.postMessage(null);
        }
        else {
            setTimeout(callback, 0);
        }
    };
var _Buffer = typeof Buffer === 'function'
    ? Buffer
    : /*#__PURE__*/ (function () {
        try {
            return _require('buffer').Buffer;
        }
        catch (_) { }
        return undefined;
    })();
var version = "1.1.1";
var NODE_API_SUPPORTED_VERSION_MAX = 9 /* Version.NODE_API_SUPPORTED_VERSION_MAX */;
var NAPI_VERSION_EXPERIMENTAL = 2147483647 /* Version.NAPI_VERSION_EXPERIMENTAL */;
var NODE_API_DEFAULT_MODULE_API_VERSION = 8 /* Version.NODE_API_DEFAULT_MODULE_API_VERSION */;

var Handle = /*#__PURE__*/ (function () {
    function Handle(id, value) {
        this.id = id;
        this.value = value;
    }
    Handle.prototype.data = function (envObject) {
        return envObject.getObjectBinding(this.value).data;
    };
    Handle.prototype.isNumber = function () {
        return typeof this.value === 'number';
    };
    Handle.prototype.isBigInt = function () {
        return typeof this.value === 'bigint';
    };
    Handle.prototype.isString = function () {
        return typeof this.value === 'string';
    };
    Handle.prototype.isFunction = function () {
        return typeof this.value === 'function';
    };
    Handle.prototype.isExternal = function () {
        return (isReferenceType(this.value) && Object.getPrototypeOf(this.value) === null);
    };
    Handle.prototype.isObject = function () {
        return typeof this.value === 'object' && this.value !== null;
    };
    Handle.prototype.isArray = function () {
        return Array.isArray(this.value);
    };
    Handle.prototype.isArrayBuffer = function () {
        return (this.value instanceof ArrayBuffer);
    };
    Handle.prototype.isTypedArray = function () {
        return (ArrayBuffer.isView(this.value)) && !(this.value instanceof DataView);
    };
    Handle.prototype.isBuffer = function () {
        return typeof _Buffer === 'function' && _Buffer.isBuffer(this.value);
    };
    Handle.prototype.isDataView = function () {
        return (this.value instanceof DataView);
    };
    Handle.prototype.isDate = function () {
        return (this.value instanceof Date);
    };
    Handle.prototype.isPromise = function () {
        return (this.value instanceof Promise);
    };
    Handle.prototype.isBoolean = function () {
        return typeof this.value === 'boolean';
    };
    Handle.prototype.isUndefined = function () {
        return this.value === undefined;
    };
    Handle.prototype.isSymbol = function () {
        return typeof this.value === 'symbol';
    };
    Handle.prototype.isNull = function () {
        return this.value === null;
    };
    Handle.prototype.dispose = function () {
        this.value = undefined;
    };
    return Handle;
}());
var ConstHandle = /*#__PURE__*/ (function (_super) {
    __extends(ConstHandle, _super);
    function ConstHandle(id, value) {
        return _super.call(this, id, value) || this;
    }
    ConstHandle.prototype.dispose = function () { };
    return ConstHandle;
}(Handle));
function External() {
    Object.setPrototypeOf(this, null);
}
External.prototype = null;
var HandleStore = /*#__PURE__*/ (function () {
    function HandleStore() {
        this._values = [
            undefined,
            HandleStore.UNDEFINED,
            HandleStore.NULL,
            HandleStore.FALSE,
            HandleStore.TRUE,
            HandleStore.GLOBAL
        ];
        this._next = HandleStore.MIN_ID;
    }
    HandleStore.prototype.push = function (value) {
        var h;
        var next = this._next;
        var values = this._values;
        if (next < values.length) {
            h = values[next];
            h.value = value;
        }
        else {
            h = new Handle(next, value);
            values[next] = h;
        }
        this._next++;
        return h;
    };
    HandleStore.prototype.erase = function (start, end) {
        this._next = start;
        var values = this._values;
        for (var i = start; i < end; ++i) {
            values[i].dispose();
        }
    };
    HandleStore.prototype.get = function (id) {
        return this._values[id];
    };
    HandleStore.prototype.swap = function (a, b) {
        var values = this._values;
        var h = values[a];
        values[a] = values[b];
        values[a].id = Number(a);
        values[b] = h;
        h.id = Number(b);
    };
    HandleStore.prototype.dispose = function () {
        this._values.length = HandleStore.MIN_ID;
        this._next = HandleStore.MIN_ID;
    };
    HandleStore.UNDEFINED = new ConstHandle(1 /* GlobalHandle.UNDEFINED */, undefined);
    HandleStore.NULL = new ConstHandle(2 /* GlobalHandle.NULL */, null);
    HandleStore.FALSE = new ConstHandle(3 /* GlobalHandle.FALSE */, false);
    HandleStore.TRUE = new ConstHandle(4 /* GlobalHandle.TRUE */, true);
    HandleStore.GLOBAL = new ConstHandle(5 /* GlobalHandle.GLOBAL */, _global);
    HandleStore.MIN_ID = 6;
    return HandleStore;
}());

var HandleScope = /*#__PURE__*/ (function () {
    function HandleScope(handleStore, id, parentScope, start, end) {
        if (end === void 0) { end = start; }
        this.handleStore = handleStore;
        this.id = id;
        this.parent = parentScope;
        this.child = null;
        if (parentScope !== null)
            parentScope.child = this;
        this.start = start;
        this.end = end;
        this._escapeCalled = false;
    }
    HandleScope.prototype.add = function (value) {
        var h = this.handleStore.push(value);
        this.end++;
        return h;
    };
    HandleScope.prototype.addExternal = function (envObject, data) {
        var value = new External();
        var h = envObject.ctx.handleStore.push(value);
        var binding = envObject.initObjectBinding(value);
        binding.data = data;
        this.end++;
        return h;
    };
    HandleScope.prototype.dispose = function () {
        if (this.start === this.end)
            return;
        this.handleStore.erase(this.start, this.end);
    };
    HandleScope.prototype.escape = function (handle) {
        if (this._escapeCalled)
            return null;
        this._escapeCalled = true;
        if (handle < this.start || handle >= this.end) {
            return null;
        }
        this.handleStore.swap(handle, this.start);
        var h = this.handleStore.get(this.start);
        this.start++;
        this.parent.end++;
        return h;
    };
    HandleScope.prototype.escapeCalled = function () {
        return this._escapeCalled;
    };
    return HandleScope;
}());

var ScopeStore = /*#__PURE__*/ (function () {
    function ScopeStore() {
        this._rootScope = new HandleScope(null, 0, null, 1, HandleStore.MIN_ID);
        this.currentScope = this._rootScope;
    }
    ScopeStore.prototype.get = function (id) {
        id = Number(id);
        var scope = this.currentScope;
        while (scope !== this._rootScope) {
            if (scope.id === id) {
                return scope;
            }
            scope = scope.parent;
        }
        return undefined;
    };
    ScopeStore.prototype.openScope = function (envObject) {
        var currentScope = this.currentScope;
        var scope = currentScope.child;
        if (scope !== null) {
            scope.start = scope.end = currentScope.end;
            scope._escapeCalled = false;
        }
        else {
            scope = new HandleScope(envObject.ctx.handleStore, currentScope.id + 1, currentScope, currentScope.end);
        }
        this.currentScope = scope;
        envObject.openHandleScopes++;
        return scope;
    };
    ScopeStore.prototype.closeScope = function (envObject) {
        if (envObject.openHandleScopes === 0)
            return;
        var scope = this.currentScope;
        this.currentScope = scope.parent;
        scope.dispose();
        envObject.openHandleScopes--;
    };
    ScopeStore.prototype.dispose = function () {
        var scope = this.currentScope;
        while (scope !== null) {
            scope.handleStore = null;
            scope.id = 0;
            scope.parent = null;
            scope.start = HandleStore.MIN_ID;
            scope.end = HandleStore.MIN_ID;
            scope._escapeCalled = false;
            var child = scope.child;
            scope.child = null;
            scope = child;
        }
        this.currentScope = null;
    };
    return ScopeStore;
}());

var RefTracker = /*#__PURE__*/ (function () {
    function RefTracker() {
        this._next = null;
        this._prev = null;
    }
    /** @virtual */
    RefTracker.prototype.finalize = function () { };
    RefTracker.prototype.link = function (list) {
        this._prev = list;
        this._next = list._next;
        if (this._next !== null) {
            this._next._prev = this;
        }
        list._next = this;
    };
    RefTracker.prototype.unlink = function () {
        if (this._prev !== null) {
            this._prev._next = this._next;
        }
        if (this._next !== null) {
            this._next._prev = this._prev;
        }
        this._prev = null;
        this._next = null;
    };
    RefTracker.finalizeAll = function (list) {
        while (list._next !== null) {
            list._next.finalize();
        }
    };
    return RefTracker;
}());

var Finalizer = /*#__PURE__*/ (function () {
    function Finalizer(envObject, _finalizeCallback, _finalizeData, _finalizeHint) {
        if (_finalizeCallback === void 0) { _finalizeCallback = 0; }
        if (_finalizeData === void 0) { _finalizeData = 0; }
        if (_finalizeHint === void 0) { _finalizeHint = 0; }
        this.envObject = envObject;
        this._finalizeCallback = _finalizeCallback;
        this._finalizeData = _finalizeData;
        this._finalizeHint = _finalizeHint;
    }
    Finalizer.prototype.callback = function () { return this._finalizeCallback; };
    Finalizer.prototype.data = function () { return this._finalizeData; };
    Finalizer.prototype.hint = function () { return this._finalizeHint; };
    Finalizer.prototype.resetFinalizer = function () {
        this._finalizeCallback = 0;
        this._finalizeData = 0;
        this._finalizeHint = 0;
    };
    Finalizer.prototype.dispose = function () {
        this.envObject = undefined;
    };
    return Finalizer;
}());

var TrackedFinalizer = /*#__PURE__*/ (function (_super) {
    __extends(TrackedFinalizer, _super);
    function TrackedFinalizer(envObject, finalize_callback, finalize_data, finalize_hint) {
        var _this = _super.call(this, envObject, finalize_callback, finalize_data, finalize_hint) || this;
        _this._next = null;
        _this._prev = null;
        _this.link(!finalize_callback ? envObject.reflist : envObject.finalizing_reflist);
        return _this;
    }
    TrackedFinalizer.finalizeAll = function (list) {
        RefTracker.finalizeAll(list);
    };
    TrackedFinalizer.prototype.link = function (list) {
        RefTracker.prototype.link.call(this, list);
    };
    TrackedFinalizer.prototype.unlink = function () {
        RefTracker.prototype.unlink.call(this);
    };
    TrackedFinalizer.create = function (envObject, finalize_callback, finalize_data, finalize_hint) {
        return new TrackedFinalizer(envObject, finalize_callback, finalize_data, finalize_hint);
    };
    TrackedFinalizer.prototype.dispose = function () {
        this.unlink();
        this.envObject.dequeueFinalizer(this);
        _super.prototype.dispose.call(this);
    };
    TrackedFinalizer.prototype.finalize = function () {
        this.finalizeCore(true);
    };
    TrackedFinalizer.prototype.finalizeCore = function (deleteMe) {
        var finalize_callback = this._finalizeCallback;
        var finalize_data = this._finalizeData;
        var finalize_hint = this._finalizeHint;
        this.resetFinalizer();
        this.unlink();
        var error;
        var caught = false;
        if (finalize_callback) {
            var fini = Number(finalize_callback);
            try {
                this.envObject.callFinalizer(fini, finalize_data, finalize_hint);
            }
            catch (err) {
                caught = true;
                error = err;
            }
        }
        if (deleteMe) {
            this.dispose();
        }
        if (caught) {
            throw error;
        }
    };
    return TrackedFinalizer;
}(Finalizer));

var RefBase = /*#__PURE__*/ (function (_super) {
    __extends(RefBase, _super);
    function RefBase(envObject, initial_refcount, ownership, finalize_callback, finalize_data, finalize_hint) {
        var _this = _super.call(this, envObject, finalize_callback, finalize_data, finalize_hint) || this;
        _this._refcount = initial_refcount;
        _this._ownership = ownership;
        return _this;
    }
    RefBase.prototype.data = function () {
        return this._finalizeData;
    };
    RefBase.prototype.ref = function () {
        return ++this._refcount;
    };
    RefBase.prototype.unref = function () {
        if (this._refcount === 0) {
            return 0;
        }
        return --this._refcount;
    };
    RefBase.prototype.refCount = function () {
        return this._refcount;
    };
    RefBase.prototype.ownership = function () {
        return this._ownership;
    };
    RefBase.prototype.finalize = function () {
        this.finalizeCore(this._ownership === 0 /* Ownership.kRuntime */);
    };
    return RefBase;
}(TrackedFinalizer));

function throwNodeApiVersionError(moduleName, moduleApiVersion) {
    var errorMessage = "".concat(moduleName, " requires Node-API version ").concat(moduleApiVersion, ", but this version of Node.js only supports version ").concat(NODE_API_SUPPORTED_VERSION_MAX, " add-ons.");
    throw new Error(errorMessage);
}
function handleThrow(envObject, value) {
    if (envObject.terminatedOrTerminating()) {
        return;
    }
    throw value;
}
var Env = /*#__PURE__*/ (function () {
    function Env(ctx, moduleApiVersion, makeDynCall_vppp, makeDynCall_vp, abort) {
        this.ctx = ctx;
        this.moduleApiVersion = moduleApiVersion;
        this.makeDynCall_vppp = makeDynCall_vppp;
        this.makeDynCall_vp = makeDynCall_vp;
        this.abort = abort;
        this.openHandleScopes = 0;
        this.instanceData = null;
        this.tryCatch = new TryCatch();
        this.refs = 1;
        this.reflist = new RefTracker();
        this.finalizing_reflist = new RefTracker();
        this.pendingFinalizers = [];
        this.lastError = {
            errorCode: 0 /* napi_status.napi_ok */,
            engineErrorCode: 0,
            engineReserved: 0
        };
        this.inGcFinalizer = false;
        this._bindingMap = new WeakMap();
        this.id = 0;
    }
    /** @virtual */
    Env.prototype.canCallIntoJs = function () {
        return true;
    };
    Env.prototype.terminatedOrTerminating = function () {
        return !this.canCallIntoJs();
    };
    Env.prototype.ref = function () {
        this.refs++;
    };
    Env.prototype.unref = function () {
        this.refs--;
        if (this.refs === 0) {
            this.dispose();
        }
    };
    Env.prototype.ensureHandle = function (value) {
        return this.ctx.ensureHandle(value);
    };
    Env.prototype.ensureHandleId = function (value) {
        return this.ensureHandle(value).id;
    };
    Env.prototype.clearLastError = function () {
        var lastError = this.lastError;
        if (lastError.errorCode !== 0 /* napi_status.napi_ok */)
            lastError.errorCode = 0 /* napi_status.napi_ok */;
        if (lastError.engineErrorCode !== 0)
            lastError.engineErrorCode = 0;
        if (lastError.engineReserved !== 0)
            lastError.engineReserved = 0;
        return 0 /* napi_status.napi_ok */;
    };
    Env.prototype.setLastError = function (error_code, engine_error_code, engine_reserved) {
        if (engine_error_code === void 0) { engine_error_code = 0; }
        if (engine_reserved === void 0) { engine_reserved = 0; }
        var lastError = this.lastError;
        if (lastError.errorCode !== error_code)
            lastError.errorCode = error_code;
        if (lastError.engineErrorCode !== engine_error_code)
            lastError.engineErrorCode = engine_error_code;
        if (lastError.engineReserved !== engine_reserved)
            lastError.engineReserved = engine_reserved;
        return error_code;
    };
    Env.prototype.getReturnStatus = function () {
        return !this.tryCatch.hasCaught() ? 0 /* napi_status.napi_ok */ : this.setLastError(10 /* napi_status.napi_pending_exception */);
    };
    Env.prototype.callIntoModule = function (fn, handleException) {
        if (handleException === void 0) { handleException = handleThrow; }
        var openHandleScopesBefore = this.openHandleScopes;
        this.clearLastError();
        var r = fn(this);
        if (openHandleScopesBefore !== this.openHandleScopes) {
            this.abort('open_handle_scopes != open_handle_scopes_before');
        }
        if (this.tryCatch.hasCaught()) {
            var err = this.tryCatch.extractException();
            handleException(this, err);
        }
        return r;
    };
    /** @virtual */
    Env.prototype.callFinalizer = function (cb, data, hint) {
        var f = this.makeDynCall_vppp(cb);
        var env = this.id;
        var scope = this.ctx.openScope(this);
        try {
            this.callIntoModule(function () { f(env, data, hint); });
        }
        finally {
            this.ctx.closeScope(this, scope);
        }
    };
    Env.prototype.invokeFinalizerFromGC = function (finalizer) {
        if (this.moduleApiVersion !== NAPI_VERSION_EXPERIMENTAL) {
            this.enqueueFinalizer(finalizer);
        }
        else {
            var saved = this.inGcFinalizer;
            this.inGcFinalizer = true;
            try {
                finalizer.finalize();
            }
            finally {
                this.inGcFinalizer = saved;
            }
        }
    };
    Env.prototype.checkGCAccess = function () {
        if (this.moduleApiVersion === NAPI_VERSION_EXPERIMENTAL && this.inGcFinalizer) {
            this.abort('Finalizer is calling a function that may affect GC state.\n' +
                'The finalizers are run directly from GC and must not affect GC ' +
                'state.\n' +
                'Use `node_api_post_finalizer` from inside of the finalizer to work ' +
                'around this issue.\n' +
                'It schedules the call as a new task in the event loop.');
        }
    };
    /** @virtual */
    Env.prototype.enqueueFinalizer = function (finalizer) {
        if (this.pendingFinalizers.indexOf(finalizer) === -1) {
            this.pendingFinalizers.push(finalizer);
        }
    };
    /** @virtual */
    Env.prototype.dequeueFinalizer = function (finalizer) {
        var index = this.pendingFinalizers.indexOf(finalizer);
        if (index !== -1) {
            this.pendingFinalizers.splice(index, 1);
        }
    };
    /** @virtual */
    Env.prototype.deleteMe = function () {
        RefBase.finalizeAll(this.finalizing_reflist);
        RefBase.finalizeAll(this.reflist);
        this.tryCatch.extractException();
        this.ctx.envStore.remove(this.id);
    };
    Env.prototype.dispose = function () {
        if (this.id === 0)
            return;
        this.deleteMe();
        this.id = 0;
    };
    Env.prototype.initObjectBinding = function (value) {
        var binding = {
            wrapped: 0,
            tag: null,
            data: 0
        };
        this._bindingMap.set(value, binding);
        return binding;
    };
    Env.prototype.getObjectBinding = function (value) {
        if (this._bindingMap.has(value)) {
            return this._bindingMap.get(value);
        }
        return this.initObjectBinding(value);
    };
    Env.prototype.setInstanceData = function (data, finalize_cb, finalize_hint) {
        if (this.instanceData) {
            this.instanceData.dispose();
        }
        this.instanceData = new RefBase(this, 0, 0 /* Ownership.kRuntime */, finalize_cb, data, finalize_hint);
    };
    Env.prototype.getInstanceData = function () {
        return this.instanceData ? this.instanceData.data() : 0;
    };
    return Env;
}());
var NodeEnv = /*#__PURE__*/ (function (_super) {
    __extends(NodeEnv, _super);
    function NodeEnv(ctx, filename, moduleApiVersion, makeDynCall_vppp, makeDynCall_vp, abort, nodeBinding) {
        var _this = _super.call(this, ctx, moduleApiVersion, makeDynCall_vppp, makeDynCall_vp, abort) || this;
        _this.filename = filename;
        _this.nodeBinding = nodeBinding;
        _this.destructing = false;
        _this.finalizationScheduled = false;
        return _this;
    }
    NodeEnv.prototype.deleteMe = function () {
        this.destructing = true;
        this.drainFinalizerQueue();
        _super.prototype.deleteMe.call(this);
    };
    NodeEnv.prototype.canCallIntoJs = function () {
        return _super.prototype.canCallIntoJs.call(this) && this.ctx.canCallIntoJs();
    };
    NodeEnv.prototype.triggerFatalException = function (err) {
        if (this.nodeBinding) {
            this.nodeBinding.napi.fatalException(err);
        }
        else {
            {
                throw err;
            }
        }
    };
    NodeEnv.prototype.callbackIntoModule = function (enforceUncaughtExceptionPolicy, fn) {
        return this.callIntoModule(fn, function (envObject, err) {
            if (envObject.terminatedOrTerminating()) {
                return;
            }
            var hasForceFlag = false;
            if (envObject.moduleApiVersion < NAPI_VERSION_EXPERIMENTAL && !hasForceFlag && !enforceUncaughtExceptionPolicy) {
                var warn = function (warning, type, code) {
                        if (warning instanceof Error) {
                            console.warn(warning.toString());
                        }
                        else {
                            var prefix = code ? "[".concat(code, "] ") : '';
                            // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
                            console.warn("".concat(prefix).concat(type || 'Warning', ": ").concat(warning));
                        }
                    };
                warn('Uncaught N-API callback exception detected, please run node with option --force-node-api-uncaught-exceptions-policy=true to handle those exceptions properly.', 'DeprecationWarning', 'DEP0168');
                return;
            }
            envObject.triggerFatalException(err);
        });
    };
    NodeEnv.prototype.callFinalizer = function (cb, data, hint) {
        this.callFinalizerInternal(1, cb, data, hint);
    };
    NodeEnv.prototype.callFinalizerInternal = function (forceUncaught, cb, data, hint) {
        var f = this.makeDynCall_vppp(cb);
        var env = this.id;
        var scope = this.ctx.openScope(this);
        try {
            this.callbackIntoModule(Boolean(forceUncaught), function () { f(env, data, hint); });
        }
        finally {
            this.ctx.closeScope(this, scope);
        }
    };
    NodeEnv.prototype.enqueueFinalizer = function (finalizer) {
        var _this = this;
        _super.prototype.enqueueFinalizer.call(this, finalizer);
        if (!this.finalizationScheduled && !this.destructing) {
            this.finalizationScheduled = true;
            this.ref();
            _setImmediate(function () {
                _this.finalizationScheduled = false;
                _this.unref();
                _this.drainFinalizerQueue();
            });
        }
    };
    NodeEnv.prototype.drainFinalizerQueue = function () {
        while (this.pendingFinalizers.length > 0) {
            var refTracker = this.pendingFinalizers.shift();
            refTracker.finalize();
        }
    };
    return NodeEnv;
}(Env));
function newEnv(ctx, filename, moduleApiVersion, makeDynCall_vppp, makeDynCall_vp, abort, nodeBinding) {
    moduleApiVersion = typeof moduleApiVersion !== 'number' ? NODE_API_DEFAULT_MODULE_API_VERSION : moduleApiVersion;
    // Validate module_api_version.
    if (moduleApiVersion < NODE_API_DEFAULT_MODULE_API_VERSION) {
        moduleApiVersion = NODE_API_DEFAULT_MODULE_API_VERSION;
    }
    else if (moduleApiVersion > NODE_API_SUPPORTED_VERSION_MAX && moduleApiVersion !== NAPI_VERSION_EXPERIMENTAL) {
        throwNodeApiVersionError(filename, moduleApiVersion);
    }
    var env = new NodeEnv(ctx, filename, moduleApiVersion, makeDynCall_vppp, makeDynCall_vp, abort, nodeBinding);
    ctx.envStore.add(env);
    ctx.addCleanupHook(env, function () { env.unref(); }, 0);
    return env;
}

var EmnapiError = /*#__PURE__*/ (function (_super) {
    __extends(EmnapiError, _super);
    function EmnapiError(message) {
        var _newTarget = this.constructor;
        var _this = _super.call(this, message) || this;
        var ErrorConstructor = _newTarget;
        var proto = ErrorConstructor.prototype;
        if (!(_this instanceof EmnapiError)) {
            var setPrototypeOf = Object.setPrototypeOf;
            if (typeof setPrototypeOf === 'function') {
                setPrototypeOf.call(Object, _this, proto);
            }
            else {
                // eslint-disable-next-line no-proto
                _this.__proto__ = proto;
            }
            if (typeof Error.captureStackTrace === 'function') {
                Error.captureStackTrace(_this, ErrorConstructor);
            }
        }
        return _this;
    }
    return EmnapiError;
}(Error));
Object.defineProperty(EmnapiError.prototype, 'name', {
    configurable: true,
    writable: true,
    value: 'EmnapiError'
});
var NotSupportWeakRefError = /*#__PURE__*/ (function (_super) {
    __extends(NotSupportWeakRefError, _super);
    function NotSupportWeakRefError(api, message) {
        return _super.call(this, "".concat(api, ": The current runtime does not support \"FinalizationRegistry\" and \"WeakRef\".").concat(message ? " ".concat(message) : '')) || this;
    }
    return NotSupportWeakRefError;
}(EmnapiError));
Object.defineProperty(NotSupportWeakRefError.prototype, 'name', {
    configurable: true,
    writable: true,
    value: 'NotSupportWeakRefError'
});
var NotSupportBufferError = /*#__PURE__*/ (function (_super) {
    __extends(NotSupportBufferError, _super);
    function NotSupportBufferError(api, message) {
        return _super.call(this, "".concat(api, ": The current runtime does not support \"Buffer\". Consider using buffer polyfill to make sure `globalThis.Buffer` is defined.").concat(message ? " ".concat(message) : '')) || this;
    }
    return NotSupportBufferError;
}(EmnapiError));
Object.defineProperty(NotSupportBufferError.prototype, 'name', {
    configurable: true,
    writable: true,
    value: 'NotSupportBufferError'
});

var StrongRef = /*#__PURE__*/ (function () {
    function StrongRef(value) {
        this._value = value;
    }
    StrongRef.prototype.deref = function () {
        return this._value;
    };
    StrongRef.prototype.dispose = function () {
        this._value = undefined;
    };
    return StrongRef;
}());
var Persistent = /*#__PURE__*/ (function () {
    function Persistent(value) {
        this._ref = new StrongRef(value);
    }
    Persistent.prototype.setWeak = function (param, callback) {
        if (!supportFinalizer || this._ref === undefined || this._ref instanceof WeakRef)
            return;
        var value = this._ref.deref();
        try {
            Persistent._registry.register(value, this, this);
            var weakRef = new WeakRef(value);
            this._ref.dispose();
            this._ref = weakRef;
            this._param = param;
            this._callback = callback;
        }
        catch (err) {
            if (typeof value === 'symbol') ;
            else {
                throw err;
            }
        }
    };
    Persistent.prototype.clearWeak = function () {
        if (!supportFinalizer || this._ref === undefined)
            return;
        if (this._ref instanceof WeakRef) {
            try {
                Persistent._registry.unregister(this);
            }
            catch (_) { }
            this._param = undefined;
            this._callback = undefined;
            var value = this._ref.deref();
            if (value === undefined) {
                this._ref = value;
            }
            else {
                this._ref = new StrongRef(value);
            }
        }
    };
    Persistent.prototype.reset = function () {
        if (supportFinalizer) {
            try {
                Persistent._registry.unregister(this);
            }
            catch (_) { }
        }
        this._param = undefined;
        this._callback = undefined;
        if (this._ref instanceof StrongRef) {
            this._ref.dispose();
        }
        this._ref = undefined;
    };
    Persistent.prototype.isEmpty = function () {
        return this._ref === undefined;
    };
    Persistent.prototype.deref = function () {
        if (this._ref === undefined)
            return undefined;
        return this._ref.deref();
    };
    Persistent._registry = supportFinalizer
        ? new FinalizationRegistry(function (value) {
            value._ref = undefined;
            var callback = value._callback;
            var param = value._param;
            value._callback = undefined;
            value._param = undefined;
            if (typeof callback === 'function') {
                callback(param);
            }
        })
        : undefined;
    return Persistent;
}());

function weakCallback(ref) {
    ref.persistent.reset();
    ref.envObject.invokeFinalizerFromGC(ref);
}
function canBeHeldWeakly(value) {
    return value.isObject() || value.isFunction() || value.isSymbol();
}
var Reference = /*#__PURE__*/ (function (_super) {
    __extends(Reference, _super);
    function Reference(envObject, initialRefcount, ownership, finalize_callback, finalize_data, finalize_hint) {
        if (finalize_callback === void 0) { finalize_callback = 0; }
        if (finalize_data === void 0) { finalize_data = 0; }
        if (finalize_hint === void 0) { finalize_hint = 0; }
        var _this = _super.call(this, envObject, initialRefcount >>> 0, ownership, finalize_callback, finalize_data, finalize_hint) || this;
        _this.id = 0;
        return _this;
    }
    Reference.create = function (envObject, handle_id, initialRefcount, ownership, finalize_callback, finalize_data, finalize_hint) {
        if (finalize_callback === void 0) { finalize_callback = 0; }
        if (finalize_data === void 0) { finalize_data = 0; }
        if (finalize_hint === void 0) { finalize_hint = 0; }
        var handle = envObject.ctx.handleStore.get(handle_id);
        var ref = new Reference(envObject, initialRefcount, ownership, finalize_callback, finalize_data, finalize_hint);
        envObject.ctx.refStore.add(ref);
        ref.canBeWeak = canBeHeldWeakly(handle);
        ref.persistent = new Persistent(handle.value);
        if (initialRefcount === 0) {
            ref._setWeak();
        }
        return ref;
    };
    Reference.prototype.ref = function () {
        if (this.persistent.isEmpty()) {
            return 0;
        }
        var count = _super.prototype.ref.call(this);
        if (count === 1 && this.canBeWeak) {
            this.persistent.clearWeak();
        }
        return count;
    };
    Reference.prototype.unref = function () {
        if (this.persistent.isEmpty()) {
            return 0;
        }
        var oldRefcount = this.refCount();
        var refcount = _super.prototype.unref.call(this);
        if (oldRefcount === 1 && refcount === 0) {
            this._setWeak();
        }
        return refcount;
    };
    Reference.prototype.get = function () {
        if (this.persistent.isEmpty()) {
            return 0;
        }
        var obj = this.persistent.deref();
        var handle = this.envObject.ensureHandle(obj);
        return handle.id;
    };
    Reference.prototype._setWeak = function () {
        if (this.canBeWeak) {
            this.persistent.setWeak(this, weakCallback);
        }
        else {
            this.persistent.reset();
        }
    };
    Reference.prototype.finalize = function () {
        this.persistent.reset();
        _super.prototype.finalize.call(this);
    };
    Reference.prototype.dispose = function () {
        if (this.id === 0)
            return;
        this.persistent.reset();
        this.envObject.ctx.refStore.remove(this.id);
        _super.prototype.dispose.call(this);
        this.id = 0;
    };
    return Reference;
}(RefBase));

var Deferred = /*#__PURE__*/ (function () {
    function Deferred(ctx, value) {
        this.id = 0;
        this.ctx = ctx;
        this.value = value;
    }
    Deferred.create = function (ctx, value) {
        var deferred = new Deferred(ctx, value);
        ctx.deferredStore.add(deferred);
        return deferred;
    };
    Deferred.prototype.resolve = function (value) {
        this.value.resolve(value);
        this.dispose();
    };
    Deferred.prototype.reject = function (reason) {
        this.value.reject(reason);
        this.dispose();
    };
    Deferred.prototype.dispose = function () {
        this.ctx.deferredStore.remove(this.id);
        this.id = 0;
        this.value = null;
        this.ctx = null;
    };
    return Deferred;
}());

var Store = /*#__PURE__*/ (function () {
    function Store() {
        this._values = [undefined];
        this._values.length = 4;
        this._size = 1;
        this._freeList = [];
    }
    Store.prototype.add = function (value) {
        var id;
        if (this._freeList.length) {
            id = this._freeList.shift();
        }
        else {
            id = this._size;
            this._size++;
            var capacity = this._values.length;
            if (id >= capacity) {
                this._values.length = capacity + (capacity >> 1) + 16;
            }
        }
        value.id = id;
        this._values[id] = value;
    };
    Store.prototype.get = function (id) {
        return this._values[id];
    };
    Store.prototype.has = function (id) {
        return this._values[id] !== undefined;
    };
    Store.prototype.remove = function (id) {
        var value = this._values[id];
        if (value) {
            value.id = 0;
            this._values[id] = undefined;
            this._freeList.push(Number(id));
        }
    };
    Store.prototype.dispose = function () {
        for (var i = 1; i < this._size; ++i) {
            var value = this._values[i];
            value === null || value === void 0 ? void 0 : value.dispose();
        }
        this._values = [undefined];
        this._size = 1;
        this._freeList = [];
    };
    return Store;
}());

var CleanupHookCallback = /*#__PURE__*/ (function () {
    function CleanupHookCallback(envObject, fn, arg, order) {
        this.envObject = envObject;
        this.fn = fn;
        this.arg = arg;
        this.order = order;
    }
    return CleanupHookCallback;
}());
var CleanupQueue = /*#__PURE__*/ (function () {
    function CleanupQueue() {
        this._cleanupHooks = [];
        this._cleanupHookCounter = 0;
    }
    CleanupQueue.prototype.empty = function () {
        return this._cleanupHooks.length === 0;
    };
    CleanupQueue.prototype.add = function (envObject, fn, arg) {
        if (this._cleanupHooks.filter(function (hook) { return (hook.envObject === envObject && hook.fn === fn && hook.arg === arg); }).length > 0) {
            throw new Error('Can not add same fn and arg twice');
        }
        this._cleanupHooks.push(new CleanupHookCallback(envObject, fn, arg, this._cleanupHookCounter++));
    };
    CleanupQueue.prototype.remove = function (envObject, fn, arg) {
        for (var i = 0; i < this._cleanupHooks.length; ++i) {
            var hook = this._cleanupHooks[i];
            if (hook.envObject === envObject && hook.fn === fn && hook.arg === arg) {
                this._cleanupHooks.splice(i, 1);
                return;
            }
        }
    };
    CleanupQueue.prototype.drain = function () {
        var hooks = this._cleanupHooks.slice();
        hooks.sort(function (a, b) { return (b.order - a.order); });
        for (var i = 0; i < hooks.length; ++i) {
            var cb = hooks[i];
            if (typeof cb.fn === 'number') {
                cb.envObject.makeDynCall_vp(cb.fn)(cb.arg);
            }
            else {
                cb.fn(cb.arg);
            }
            this._cleanupHooks.splice(this._cleanupHooks.indexOf(cb), 1);
        }
    };
    CleanupQueue.prototype.dispose = function () {
        this._cleanupHooks.length = 0;
        this._cleanupHookCounter = 0;
    };
    return CleanupQueue;
}());
var Context = /*#__PURE__*/ (function () {
    function Context() {
        this._isStopping = false;
        this._canCallIntoJs = true;
        this.envStore = new Store();
        this.scopeStore = new ScopeStore();
        this.refStore = new Store();
        this.deferredStore = new Store();
        this.handleStore = new HandleStore();
        this.cbinfoStack = new CallbackInfoStack();
        this.feature = {
            supportReflect: supportReflect,
            supportFinalizer: supportFinalizer,
            supportWeakSymbol: supportWeakSymbol,
            supportBigInt: supportBigInt,
            supportNewFunction: supportNewFunction,
            canSetFunctionName: canSetFunctionName,
            setImmediate: _setImmediate,
            Buffer: _Buffer,
            MessageChannel: _MessageChannel
        };
        this.cleanupQueue = new CleanupQueue();
    }
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    Context.prototype.getRuntimeVersions = function () {
        return {
            version: version,
            NODE_API_SUPPORTED_VERSION_MAX: NODE_API_SUPPORTED_VERSION_MAX,
            NAPI_VERSION_EXPERIMENTAL: NAPI_VERSION_EXPERIMENTAL,
            NODE_API_DEFAULT_MODULE_API_VERSION: NODE_API_DEFAULT_MODULE_API_VERSION
        };
    };
    Context.prototype.createNotSupportWeakRefError = function (api, message) {
        return new NotSupportWeakRefError(api, message);
    };
    Context.prototype.createNotSupportBufferError = function (api, message) {
        return new NotSupportBufferError(api, message);
    };
    Context.prototype.createReference = function (envObject, handle_id, initialRefcount, ownership, finalize_callback, finalize_data, finalize_hint) {
        if (finalize_callback === void 0) { finalize_callback = 0; }
        if (finalize_data === void 0) { finalize_data = 0; }
        if (finalize_hint === void 0) { finalize_hint = 0; }
        return Reference.create(envObject, handle_id, initialRefcount, ownership, finalize_callback, finalize_data, finalize_hint);
    };
    Context.prototype.createDeferred = function (value) {
        return Deferred.create(this, value);
    };
    Context.prototype.createEnv = function (filename, moduleApiVersion, makeDynCall_vppp, makeDynCall_vp, abort, nodeBinding) {
        return newEnv(this, filename, moduleApiVersion, makeDynCall_vppp, makeDynCall_vp, abort, nodeBinding);
    };
    Context.prototype.createTrackedFinalizer = function (envObject, finalize_callback, finalize_data, finalize_hint) {
        return TrackedFinalizer.create(envObject, finalize_callback, finalize_data, finalize_hint);
    };
    Context.prototype.getCurrentScope = function () {
        return this.scopeStore.currentScope;
    };
    Context.prototype.addToCurrentScope = function (value) {
        return this.scopeStore.currentScope.add(value);
    };
    Context.prototype.openScope = function (envObject) {
        return this.scopeStore.openScope(envObject);
    };
    Context.prototype.closeScope = function (envObject, _scope) {
        this.scopeStore.closeScope(envObject);
    };
    Context.prototype.ensureHandle = function (value) {
        switch (value) {
            case undefined: return HandleStore.UNDEFINED;
            case null: return HandleStore.NULL;
            case true: return HandleStore.TRUE;
            case false: return HandleStore.FALSE;
            case _global: return HandleStore.GLOBAL;
        }
        return this.addToCurrentScope(value);
    };
    Context.prototype.addCleanupHook = function (envObject, fn, arg) {
        this.cleanupQueue.add(envObject, fn, arg);
    };
    Context.prototype.removeCleanupHook = function (envObject, fn, arg) {
        this.cleanupQueue.remove(envObject, fn, arg);
    };
    Context.prototype.runCleanup = function () {
        while (!this.cleanupQueue.empty()) {
            this.cleanupQueue.drain();
        }
    };
    Context.prototype.increaseWaitingRequestCounter = function () {
        var _a;
        (_a = this.refCounter) === null || _a === void 0 ? void 0 : _a.increase();
    };
    Context.prototype.decreaseWaitingRequestCounter = function () {
        var _a;
        (_a = this.refCounter) === null || _a === void 0 ? void 0 : _a.decrease();
    };
    Context.prototype.setCanCallIntoJs = function (value) {
        this._canCallIntoJs = value;
    };
    Context.prototype.setStopping = function (value) {
        this._isStopping = value;
    };
    Context.prototype.canCallIntoJs = function () {
        return this._canCallIntoJs && !this._isStopping;
    };
    Context.prototype.destroy = function () {
        this.setStopping(true);
        this.setCanCallIntoJs(false);
        this.runCleanup();
    };
    return Context;
}());
var defaultContext;
function createContext() {
    return new Context();
}
function getDefaultContext() {
    if (!defaultContext) {
        defaultContext = createContext();
    }
    return defaultContext;
}

const _WebAssembly = typeof WebAssembly !== 'undefined'
    ? WebAssembly
    : typeof WXWebAssembly !== 'undefined'
        ? WXWebAssembly
        : undefined;
if (!_WebAssembly) {
    throw new Error('WebAssembly is not supported in this environment');
}

/* eslint-disable spaced-comment */

function validateObject(value, name) {
    if (value === null || typeof value !== 'object') {
        throw new TypeError(`${name} must be an object. Received ${value === null ? 'null' : typeof value}`);
    }
}
function validateArray(value, name) {
    if (!Array.isArray(value)) {
        throw new TypeError(`${name} must be an array. Received ${value === null ? 'null' : typeof value}`);
    }
}
function validateBoolean(value, name) {
    if (typeof value !== 'boolean') {
        throw new TypeError(`${name} must be a boolean. Received ${value === null ? 'null' : typeof value}`);
    }
}
function validateString(value, name) {
    if (typeof value !== 'string') {
        throw new TypeError(`${name} must be a string. Received ${value === null ? 'null' : typeof value}`);
    }
}
function validateFunction(value, name) {
    if (typeof value !== 'function') {
        throw new TypeError(`${name} must be a function. Received ${value === null ? 'null' : typeof value}`);
    }
}
function validateUndefined(value, name) {
    if (value !== undefined) {
        throw new TypeError(`${name} must be undefined. Received ${value === null ? 'null' : typeof value}`);
    }
}
function isPromiseLike(obj) {
    return !!(obj && (typeof obj === 'object' || typeof obj === 'function') && typeof obj.then === 'function');
}
function unsharedSlice(view, start, end) {
    return ((typeof SharedArrayBuffer === 'function' && view.buffer instanceof SharedArrayBuffer) || (Object.prototype.toString.call(view.buffer.constructor) === '[object SharedArrayBuffer]'))
        ? view.slice(start, end)
        : view.subarray(start, end);
}

const CHAR_DOT = 46; /* . */
const CHAR_FORWARD_SLASH = 47; /* / */
function isPosixPathSeparator(code) {
    return code === CHAR_FORWARD_SLASH;
}
function normalizeString(path, allowAboveRoot, separator, isPathSeparator) {
    let res = '';
    let lastSegmentLength = 0;
    let lastSlash = -1;
    let dots = 0;
    let code = 0;
    for (let i = 0; i <= path.length; ++i) {
        if (i < path.length) {
            code = path.charCodeAt(i);
        }
        else if (isPathSeparator(code)) {
            break;
        }
        else {
            code = CHAR_FORWARD_SLASH;
        }
        if (isPathSeparator(code)) {
            if (lastSlash === i - 1 || dots === 1) ;
            else if (dots === 2) {
                if (res.length < 2 || lastSegmentLength !== 2 ||
                    res.charCodeAt(res.length - 1) !== CHAR_DOT ||
                    res.charCodeAt(res.length - 2) !== CHAR_DOT) {
                    if (res.length > 2) {
                        const lastSlashIndex = res.indexOf(separator);
                        if (lastSlashIndex === -1) {
                            res = '';
                            lastSegmentLength = 0;
                        }
                        else {
                            res = res.slice(0, lastSlashIndex);
                            lastSegmentLength =
                                res.length - 1 - res.indexOf(separator);
                        }
                        lastSlash = i;
                        dots = 0;
                        continue;
                    }
                    else if (res.length !== 0) {
                        res = '';
                        lastSegmentLength = 0;
                        lastSlash = i;
                        dots = 0;
                        continue;
                    }
                }
                if (allowAboveRoot) {
                    res += res.length > 0 ? `${separator}..` : '..';
                    lastSegmentLength = 2;
                }
            }
            else {
                if (res.length > 0) {
                    res += `${separator}${path.slice(lastSlash + 1, i)}`;
                }
                else {
                    res = path.slice(lastSlash + 1, i);
                }
                lastSegmentLength = i - lastSlash - 1;
            }
            lastSlash = i;
            dots = 0;
        }
        else if (code === CHAR_DOT && dots !== -1) {
            ++dots;
        }
        else {
            dots = -1;
        }
    }
    return res;
}
function resolve(...args) {
    let resolvedPath = '';
    let resolvedAbsolute = false;
    for (let i = args.length - 1; i >= -1 && !resolvedAbsolute; i--) {
        const path = i >= 0 ? args[i] : '/';
        validateString(path, 'path');
        // Skip empty entries
        if (path.length === 0) {
            continue;
        }
        resolvedPath = `${path}/${resolvedPath}`;
        resolvedAbsolute = path.charCodeAt(0) === CHAR_FORWARD_SLASH;
    }
    // At this point the path should be resolved to a full absolute path, but
    // handle relative paths to be safe (might happen when process.cwd() fails)
    // Normalize the path
    resolvedPath = normalizeString(resolvedPath, !resolvedAbsolute, '/', isPosixPathSeparator);
    if (resolvedAbsolute) {
        return `/${resolvedPath}`;
    }
    return resolvedPath.length > 0 ? resolvedPath : '.';
}

const FD_DATASYNC = ( /*#__PURE__*/BigInt(1) << /*#__PURE__*/ BigInt(0));
const FD_READ = ( /*#__PURE__*/BigInt(1) << /*#__PURE__*/ BigInt(1));
const FD_SEEK = ( /*#__PURE__*/BigInt(1) << /*#__PURE__*/ BigInt(2));
const FD_FDSTAT_SET_FLAGS = ( /*#__PURE__*/BigInt(1) << /*#__PURE__*/ BigInt(3));
const FD_SYNC = ( /*#__PURE__*/BigInt(1) << /*#__PURE__*/ BigInt(4));
const FD_TELL = ( /*#__PURE__*/BigInt(1) << /*#__PURE__*/ BigInt(5));
const FD_WRITE = ( /*#__PURE__*/BigInt(1) << /*#__PURE__*/ BigInt(6));
const FD_ADVISE = ( /*#__PURE__*/BigInt(1) << /*#__PURE__*/ BigInt(7));
const FD_ALLOCATE = ( /*#__PURE__*/BigInt(1) << /*#__PURE__*/ BigInt(8));
const PATH_CREATE_DIRECTORY = ( /*#__PURE__*/BigInt(1) << /*#__PURE__*/ BigInt(9));
const PATH_CREATE_FILE = ( /*#__PURE__*/BigInt(1) << /*#__PURE__*/ BigInt(10));
const PATH_LINK_SOURCE = ( /*#__PURE__*/BigInt(1) << /*#__PURE__*/ BigInt(11));
const PATH_LINK_TARGET = ( /*#__PURE__*/BigInt(1) << /*#__PURE__*/ BigInt(12));
const PATH_OPEN = ( /*#__PURE__*/BigInt(1) << /*#__PURE__*/ BigInt(13));
const FD_READDIR = ( /*#__PURE__*/BigInt(1) << /*#__PURE__*/ BigInt(14));
const PATH_READLINK = ( /*#__PURE__*/BigInt(1) << /*#__PURE__*/ BigInt(15));
const PATH_RENAME_SOURCE = ( /*#__PURE__*/BigInt(1) << /*#__PURE__*/ BigInt(16));
const PATH_RENAME_TARGET = ( /*#__PURE__*/BigInt(1) << /*#__PURE__*/ BigInt(17));
const PATH_FILESTAT_GET = ( /*#__PURE__*/BigInt(1) << /*#__PURE__*/ BigInt(18));
const PATH_FILESTAT_SET_SIZE = ( /*#__PURE__*/BigInt(1) << /*#__PURE__*/ BigInt(19));
const PATH_FILESTAT_SET_TIMES = ( /*#__PURE__*/BigInt(1) << /*#__PURE__*/ BigInt(20));
const FD_FILESTAT_GET = ( /*#__PURE__*/BigInt(1) << /*#__PURE__*/ BigInt(21));
const FD_FILESTAT_SET_SIZE = ( /*#__PURE__*/BigInt(1) << /*#__PURE__*/ BigInt(22));
const FD_FILESTAT_SET_TIMES = ( /*#__PURE__*/BigInt(1) << /*#__PURE__*/ BigInt(23));
const PATH_SYMLINK = ( /*#__PURE__*/BigInt(1) << /*#__PURE__*/ BigInt(24));
const PATH_REMOVE_DIRECTORY = ( /*#__PURE__*/BigInt(1) << /*#__PURE__*/ BigInt(25));
const PATH_UNLINK_FILE = ( /*#__PURE__*/BigInt(1) << /*#__PURE__*/ BigInt(26));
const POLL_FD_READWRITE = ( /*#__PURE__*/BigInt(1) << /*#__PURE__*/ BigInt(27));
const SOCK_SHUTDOWN = ( /*#__PURE__*/BigInt(1) << /*#__PURE__*/ BigInt(28));
const SOCK_ACCEPT = ( /*#__PURE__*/BigInt(1) << /*#__PURE__*/ BigInt(29));
const WasiRights = {
    FD_DATASYNC,
    FD_READ,
    FD_SEEK,
    FD_FDSTAT_SET_FLAGS,
    FD_SYNC,
    FD_TELL,
    FD_WRITE,
    FD_ADVISE,
    FD_ALLOCATE,
    PATH_CREATE_DIRECTORY,
    PATH_CREATE_FILE,
    PATH_LINK_SOURCE,
    PATH_LINK_TARGET,
    PATH_OPEN,
    FD_READDIR,
    PATH_READLINK,
    PATH_RENAME_SOURCE,
    PATH_RENAME_TARGET,
    PATH_FILESTAT_GET,
    PATH_FILESTAT_SET_SIZE,
    PATH_FILESTAT_SET_TIMES,
    FD_FILESTAT_GET,
    FD_FILESTAT_SET_SIZE,
    FD_FILESTAT_SET_TIMES,
    PATH_SYMLINK,
    PATH_REMOVE_DIRECTORY,
    PATH_UNLINK_FILE,
    POLL_FD_READWRITE,
    SOCK_SHUTDOWN,
    SOCK_ACCEPT
};

function strerror(errno) {
    switch (errno) {
        case 0 /* WasiErrno.ESUCCESS */: return 'Success';
        case 1 /* WasiErrno.E2BIG */: return 'Argument list too long';
        case 2 /* WasiErrno.EACCES */: return 'Permission denied';
        case 3 /* WasiErrno.EADDRINUSE */: return 'Address in use';
        case 4 /* WasiErrno.EADDRNOTAVAIL */: return 'Address not available';
        case 5 /* WasiErrno.EAFNOSUPPORT */: return 'Address family not supported by protocol';
        case 6 /* WasiErrno.EAGAIN */: return 'Resource temporarily unavailable';
        case 7 /* WasiErrno.EALREADY */: return 'Operation already in progress';
        case 8 /* WasiErrno.EBADF */: return 'Bad file descriptor';
        case 9 /* WasiErrno.EBADMSG */: return 'Bad message';
        case 10 /* WasiErrno.EBUSY */: return 'Resource busy';
        case 11 /* WasiErrno.ECANCELED */: return 'Operation canceled';
        case 12 /* WasiErrno.ECHILD */: return 'No child null';
        case 13 /* WasiErrno.ECONNABORTED */: return 'Connection aborted';
        case 14 /* WasiErrno.ECONNREFUSED */: return 'Connection refused';
        case 15 /* WasiErrno.ECONNRESET */: return 'Connection reset by peer';
        case 16 /* WasiErrno.EDEADLK */: return 'Resource deadlock would occur';
        case 17 /* WasiErrno.EDESTADDRREQ */: return 'Destination address required';
        case 18 /* WasiErrno.EDOM */: return 'Domain error';
        case 19 /* WasiErrno.EDQUOT */: return 'Quota exceeded';
        case 20 /* WasiErrno.EEXIST */: return 'File exists';
        case 21 /* WasiErrno.EFAULT */: return 'Bad address';
        case 22 /* WasiErrno.EFBIG */: return 'File too large';
        case 23 /* WasiErrno.EHOSTUNREACH */: return 'Host is unreachable';
        case 24 /* WasiErrno.EIDRM */: return 'Identifier removed';
        case 25 /* WasiErrno.EILSEQ */: return 'Illegal byte sequence';
        case 26 /* WasiErrno.EINPROGRESS */: return 'Operation in progress';
        case 27 /* WasiErrno.EINTR */: return 'Interrupted system call';
        case 28 /* WasiErrno.EINVAL */: return 'Invalid argument';
        case 29 /* WasiErrno.EIO */: return 'I/O error';
        case 30 /* WasiErrno.EISCONN */: return 'Socket is connected';
        case 31 /* WasiErrno.EISDIR */: return 'Is a directory';
        case 32 /* WasiErrno.ELOOP */: return 'Symbolic link loop';
        case 33 /* WasiErrno.EMFILE */: return 'No file descriptors available';
        case 34 /* WasiErrno.EMLINK */: return 'Too many links';
        case 35 /* WasiErrno.EMSGSIZE */: return 'Message too large';
        case 36 /* WasiErrno.EMULTIHOP */: return 'Multihop attempted';
        case 37 /* WasiErrno.ENAMETOOLONG */: return 'Filename too long';
        case 38 /* WasiErrno.ENETDOWN */: return 'Network is down';
        case 39 /* WasiErrno.ENETRESET */: return 'Connection reset by network';
        case 40 /* WasiErrno.ENETUNREACH */: return 'Network unreachable';
        case 41 /* WasiErrno.ENFILE */: return 'Too many files open in system';
        case 42 /* WasiErrno.ENOBUFS */: return 'No buffer space available';
        case 43 /* WasiErrno.ENODEV */: return 'No such device';
        case 44 /* WasiErrno.ENOENT */: return 'No such file or directory';
        case 45 /* WasiErrno.ENOEXEC */: return 'Exec format error';
        case 46 /* WasiErrno.ENOLCK */: return 'No locks available';
        case 47 /* WasiErrno.ENOLINK */: return 'Link has been severed';
        case 48 /* WasiErrno.ENOMEM */: return 'Out of memory';
        case 49 /* WasiErrno.ENOMSG */: return 'No message of the desired type';
        case 50 /* WasiErrno.ENOPROTOOPT */: return 'Protocol not available';
        case 51 /* WasiErrno.ENOSPC */: return 'No space left on device';
        case 52 /* WasiErrno.ENOSYS */: return 'Function not implemented';
        case 53 /* WasiErrno.ENOTCONN */: return 'Socket not connected';
        case 54 /* WasiErrno.ENOTDIR */: return 'Not a directory';
        case 55 /* WasiErrno.ENOTEMPTY */: return 'Directory not empty';
        case 56 /* WasiErrno.ENOTRECOVERABLE */: return 'State not recoverable';
        case 57 /* WasiErrno.ENOTSOCK */: return 'Not a socket';
        case 58 /* WasiErrno.ENOTSUP */: return 'Not supported';
        case 59 /* WasiErrno.ENOTTY */: return 'Not a tty';
        case 60 /* WasiErrno.ENXIO */: return 'No such device or address';
        case 61 /* WasiErrno.EOVERFLOW */: return 'Value too large for data type';
        case 62 /* WasiErrno.EOWNERDEAD */: return 'Previous owner died';
        case 63 /* WasiErrno.EPERM */: return 'Operation not permitted';
        case 64 /* WasiErrno.EPIPE */: return 'Broken pipe';
        case 65 /* WasiErrno.EPROTO */: return 'Protocol error';
        case 66 /* WasiErrno.EPROTONOSUPPORT */: return 'Protocol not supported';
        case 67 /* WasiErrno.EPROTOTYPE */: return 'Protocol wrong type for socket';
        case 68 /* WasiErrno.ERANGE */: return 'Result not representable';
        case 69 /* WasiErrno.EROFS */: return 'Read-only file system';
        case 70 /* WasiErrno.ESPIPE */: return 'Invalid seek';
        case 71 /* WasiErrno.ESRCH */: return 'No such null';
        case 72 /* WasiErrno.ESTALE */: return 'Stale file handle';
        case 73 /* WasiErrno.ETIMEDOUT */: return 'Operation timed out';
        case 74 /* WasiErrno.ETXTBSY */: return 'Text file busy';
        case 75 /* WasiErrno.EXDEV */: return 'Cross-device link';
        case 76 /* WasiErrno.ENOTCAPABLE */: return 'Capabilities insufficient';
        default: return 'Unknown error';
    }
}
class WasiError extends Error {
    constructor(message, errno) {
        super(message);
        this.errno = errno;
    }
    getErrorMessage() {
        return strerror(this.errno);
    }
}
Object.defineProperty(WasiError.prototype, 'name', {
    configurable: true,
    writable: true,
    value: 'WasiError'
});

const RIGHTS_ALL = WasiRights.FD_DATASYNC |
    WasiRights.FD_READ |
    WasiRights.FD_SEEK |
    WasiRights.FD_FDSTAT_SET_FLAGS |
    WasiRights.FD_SYNC |
    WasiRights.FD_TELL |
    WasiRights.FD_WRITE |
    WasiRights.FD_ADVISE |
    WasiRights.FD_ALLOCATE |
    WasiRights.PATH_CREATE_DIRECTORY |
    WasiRights.PATH_CREATE_FILE |
    WasiRights.PATH_LINK_SOURCE |
    WasiRights.PATH_LINK_TARGET |
    WasiRights.PATH_OPEN |
    WasiRights.FD_READDIR |
    WasiRights.PATH_READLINK |
    WasiRights.PATH_RENAME_SOURCE |
    WasiRights.PATH_RENAME_TARGET |
    WasiRights.PATH_FILESTAT_GET |
    WasiRights.PATH_FILESTAT_SET_SIZE |
    WasiRights.PATH_FILESTAT_SET_TIMES |
    WasiRights.FD_FILESTAT_GET |
    WasiRights.FD_FILESTAT_SET_TIMES |
    WasiRights.FD_FILESTAT_SET_SIZE |
    WasiRights.PATH_SYMLINK |
    WasiRights.PATH_UNLINK_FILE |
    WasiRights.PATH_REMOVE_DIRECTORY |
    WasiRights.POLL_FD_READWRITE |
    WasiRights.SOCK_SHUTDOWN |
    WasiRights.SOCK_ACCEPT;
const BLOCK_DEVICE_BASE = RIGHTS_ALL;
const BLOCK_DEVICE_INHERITING = RIGHTS_ALL;
const CHARACTER_DEVICE_BASE = RIGHTS_ALL;
const CHARACTER_DEVICE_INHERITING = RIGHTS_ALL;
const REGULAR_FILE_BASE = WasiRights.FD_DATASYNC |
    WasiRights.FD_READ |
    WasiRights.FD_SEEK |
    WasiRights.FD_FDSTAT_SET_FLAGS |
    WasiRights.FD_SYNC |
    WasiRights.FD_TELL |
    WasiRights.FD_WRITE |
    WasiRights.FD_ADVISE |
    WasiRights.FD_ALLOCATE |
    WasiRights.FD_FILESTAT_GET |
    WasiRights.FD_FILESTAT_SET_SIZE |
    WasiRights.FD_FILESTAT_SET_TIMES |
    WasiRights.POLL_FD_READWRITE;
const REGULAR_FILE_INHERITING = /*#__PURE__*/ BigInt(0);
const DIRECTORY_BASE = WasiRights.FD_FDSTAT_SET_FLAGS |
    WasiRights.FD_SYNC |
    WasiRights.FD_ADVISE |
    WasiRights.PATH_CREATE_DIRECTORY |
    WasiRights.PATH_CREATE_FILE |
    WasiRights.PATH_LINK_SOURCE |
    WasiRights.PATH_LINK_TARGET |
    WasiRights.PATH_OPEN |
    WasiRights.FD_READDIR |
    WasiRights.PATH_READLINK |
    WasiRights.PATH_RENAME_SOURCE |
    WasiRights.PATH_RENAME_TARGET |
    WasiRights.PATH_FILESTAT_GET |
    WasiRights.PATH_FILESTAT_SET_SIZE |
    WasiRights.PATH_FILESTAT_SET_TIMES |
    WasiRights.FD_FILESTAT_GET |
    WasiRights.FD_FILESTAT_SET_TIMES |
    WasiRights.PATH_SYMLINK |
    WasiRights.PATH_UNLINK_FILE |
    WasiRights.PATH_REMOVE_DIRECTORY |
    WasiRights.POLL_FD_READWRITE;
const DIRECTORY_INHERITING = DIRECTORY_BASE | REGULAR_FILE_BASE;
const SOCKET_BASE = (WasiRights.FD_READ |
    WasiRights.FD_FDSTAT_SET_FLAGS |
    WasiRights.FD_WRITE |
    WasiRights.FD_FILESTAT_GET |
    WasiRights.POLL_FD_READWRITE |
    WasiRights.SOCK_SHUTDOWN);
const SOCKET_INHERITING = RIGHTS_ALL;
const TTY_BASE = WasiRights.FD_READ |
    WasiRights.FD_FDSTAT_SET_FLAGS |
    WasiRights.FD_WRITE |
    WasiRights.FD_FILESTAT_GET |
    WasiRights.POLL_FD_READWRITE;
const TTY_INHERITING = /*#__PURE__*/ BigInt(0);
function getRights(stdio, fd, flags, type) {
    const ret = {
        base: BigInt(0),
        inheriting: BigInt(0)
    };
    if (type === 0 /* WasiFileType.UNKNOWN */) {
        throw new WasiError('Unknown file type', 28 /* WasiErrno.EINVAL */);
    }
    switch (type) {
        case 4 /* WasiFileType.REGULAR_FILE */:
            ret.base = REGULAR_FILE_BASE;
            ret.inheriting = REGULAR_FILE_INHERITING;
            break;
        case 3 /* WasiFileType.DIRECTORY */:
            ret.base = DIRECTORY_BASE;
            ret.inheriting = DIRECTORY_INHERITING;
            break;
        case 6 /* WasiFileType.SOCKET_STREAM */:
        case 5 /* WasiFileType.SOCKET_DGRAM */:
            ret.base = SOCKET_BASE;
            ret.inheriting = SOCKET_INHERITING;
            break;
        case 2 /* WasiFileType.CHARACTER_DEVICE */:
            if (stdio.indexOf(fd) !== -1) {
                ret.base = TTY_BASE;
                ret.inheriting = TTY_INHERITING;
            }
            else {
                ret.base = CHARACTER_DEVICE_BASE;
                ret.inheriting = CHARACTER_DEVICE_INHERITING;
            }
            break;
        case 1 /* WasiFileType.BLOCK_DEVICE */:
            ret.base = BLOCK_DEVICE_BASE;
            ret.inheriting = BLOCK_DEVICE_INHERITING;
            break;
        default:
            ret.base = BigInt(0);
            ret.inheriting = BigInt(0);
    }
    /* Disable read/write bits depending on access mode. */
    const read_or_write_only = flags & (0 | 1 | 2);
    if (read_or_write_only === 0) {
        ret.base &= ~WasiRights.FD_WRITE;
    }
    else if (read_or_write_only === 1) {
        ret.base &= ~WasiRights.FD_READ;
    }
    return ret;
}

function concatBuffer(buffers, size) {
    let total = 0;
    {
        for (let i = 0; i < buffers.length; i++) {
            const buffer = buffers[i];
            total += buffer.length;
        }
    }
    let pos = 0;
    const ret = new Uint8Array(total);
    for (let i = 0; i < buffers.length; i++) {
        const buffer = buffers[i];
        ret.set(buffer, pos);
        pos += buffer.length;
    }
    return ret;
}
class FileDescriptor {
    constructor(id, fd, path, realPath, type, rightsBase, rightsInheriting, preopen) {
        this.id = id;
        this.fd = fd;
        this.path = path;
        this.realPath = realPath;
        this.type = type;
        this.rightsBase = rightsBase;
        this.rightsInheriting = rightsInheriting;
        this.preopen = preopen;
        this.pos = BigInt(0);
        this.size = BigInt(0);
    }
    seek(offset, whence) {
        if (whence === 0 /* WasiWhence.SET */) {
            this.pos = BigInt(offset);
        }
        else if (whence === 1 /* WasiWhence.CUR */) {
            this.pos += BigInt(offset);
        }
        else if (whence === 2 /* WasiWhence.END */) {
            this.pos = BigInt(this.size) - BigInt(offset);
        }
        else {
            throw new WasiError('Unknown whence', 29 /* WasiErrno.EIO */);
        }
        return this.pos;
    }
}
class StandardOutput extends FileDescriptor {
    constructor(log, id, fd, path, realPath, type, rightsBase, rightsInheriting, preopen) {
        super(id, fd, path, realPath, type, rightsBase, rightsInheriting, preopen);
        this._log = log;
        this._buf = null;
    }
    write(buffer) {
        const originalBuffer = buffer;
        if (this._buf) {
            buffer = concatBuffer([this._buf, buffer]);
            this._buf = null;
        }
        if (buffer.indexOf(10) === -1) {
            this._buf = buffer;
            return originalBuffer.byteLength;
        }
        let written = 0;
        let lastBegin = 0;
        let index;
        while ((index = buffer.indexOf(10, written)) !== -1) {
            const str = new TextDecoder().decode(buffer.subarray(lastBegin, index));
            this._log(str);
            written += index - lastBegin + 1;
            lastBegin = index + 1;
        }
        if (written < buffer.length) {
            this._buf = buffer.slice(written);
        }
        return originalBuffer.byteLength;
    }
}
function toFileType(stat) {
    if (stat.isBlockDevice())
        return 1 /* WasiFileType.BLOCK_DEVICE */;
    if (stat.isCharacterDevice())
        return 2 /* WasiFileType.CHARACTER_DEVICE */;
    if (stat.isDirectory())
        return 3 /* WasiFileType.DIRECTORY */;
    if (stat.isSocket())
        return 6 /* WasiFileType.SOCKET_STREAM */;
    if (stat.isFile())
        return 4 /* WasiFileType.REGULAR_FILE */;
    if (stat.isSymbolicLink())
        return 7 /* WasiFileType.SYMBOLIC_LINK */;
    return 0 /* WasiFileType.UNKNOWN */;
}
function toFileStat(view, buf, stat) {
    view.setBigUint64(buf, stat.dev, true);
    view.setBigUint64(buf + 8, stat.ino, true);
    view.setBigUint64(buf + 16, BigInt(toFileType(stat)), true);
    view.setBigUint64(buf + 24, stat.nlink, true);
    view.setBigUint64(buf + 32, stat.size, true);
    view.setBigUint64(buf + 40, stat.atimeMs * BigInt(1000000), true);
    view.setBigUint64(buf + 48, stat.mtimeMs * BigInt(1000000), true);
    view.setBigUint64(buf + 56, stat.ctimeMs * BigInt(1000000), true);
}
class FileDescriptorTable {
    constructor(options) {
        this.used = 0;
        this.size = options.size;
        this.fds = Array(options.size);
        this.stdio = [options.in, options.out, options.err];
        this.print = options.print;
        this.printErr = options.printErr;
        this.insertStdio(options.in, 0, '<stdin>');
        this.insertStdio(options.out, 1, '<stdout>');
        this.insertStdio(options.err, 2, '<stderr>');
    }
    insertStdio(fd, expected, name) {
        const type = 2 /* WasiFileType.CHARACTER_DEVICE */;
        const { base, inheriting } = getRights(this.stdio, fd, 2 /* FileControlFlag.O_RDWR */, type);
        const wrap = this.insert(fd, name, name, type, base, inheriting, 0);
        if (wrap.id !== expected) {
            throw new WasiError(`id: ${wrap.id} !== expected: ${expected}`, 8 /* WasiErrno.EBADF */);
        }
        return wrap;
    }
    insert(fd, mappedPath, realPath, type, rightsBase, rightsInheriting, preopen) {
        var _a, _b;
        let index = -1;
        if (this.used >= this.size) {
            const newSize = this.size * 2;
            this.fds.length = newSize;
            index = this.size;
            this.size = newSize;
        }
        else {
            for (let i = 0; i < this.size; ++i) {
                if (this.fds[i] == null) {
                    index = i;
                    break;
                }
            }
        }
        let entry;
        if (mappedPath === '<stdout>') {
            entry = new StandardOutput((_a = this.print) !== null && _a !== void 0 ? _a : console.log, index, fd, mappedPath, realPath, type, rightsBase, rightsInheriting, preopen);
        }
        else if (mappedPath === '<stderr>') {
            entry = new StandardOutput((_b = this.printErr) !== null && _b !== void 0 ? _b : console.error, index, fd, mappedPath, realPath, type, rightsBase, rightsInheriting, preopen);
        }
        else {
            entry = new FileDescriptor(index, fd, mappedPath, realPath, type, rightsBase, rightsInheriting, preopen);
        }
        this.fds[index] = entry;
        this.used++;
        return entry;
    }
    get(id, base, inheriting) {
        if (id >= this.size) {
            throw new WasiError('Invalid fd', 8 /* WasiErrno.EBADF */);
        }
        const entry = this.fds[id];
        if (!entry || entry.id !== id) {
            throw new WasiError('Bad file descriptor', 8 /* WasiErrno.EBADF */);
        }
        /* Validate that the fd has the necessary rights. */
        if ((~entry.rightsBase & base) !== BigInt(0) || (~entry.rightsInheriting & inheriting) !== BigInt(0)) {
            throw new WasiError('Capabilities insufficient', 76 /* WasiErrno.ENOTCAPABLE */);
        }
        return entry;
    }
    remove(id) {
        if (id >= this.size) {
            throw new WasiError('Invalid fd', 8 /* WasiErrno.EBADF */);
        }
        const entry = this.fds[id];
        if (!entry || entry.id !== id) {
            throw new WasiError('Bad file descriptor', 8 /* WasiErrno.EBADF */);
        }
        this.fds[id] = undefined;
        this.used--;
    }
}
class SyncTable extends FileDescriptorTable {
    constructor(options) {
        super(options);
        this.fs = options.fs;
    }
    getFileTypeByFd(fd) {
        const stats = this.fs.fstatSync(fd, { bigint: true });
        return toFileType(stats);
    }
    insertPreopen(fd, mappedPath, realPath) {
        const type = this.getFileTypeByFd(fd);
        if (type !== 3 /* WasiFileType.DIRECTORY */) {
            throw new WasiError(`Preopen not dir: ["${mappedPath}", "${realPath}"]`, 54 /* WasiErrno.ENOTDIR */);
        }
        const result = getRights(this.stdio, fd, 0, type);
        return this.insert(fd, mappedPath, realPath, type, result.base, result.inheriting, 1);
    }
    renumber(dst, src) {
        if (dst === src)
            return;
        if (dst >= this.size || src >= this.size) {
            throw new WasiError('Invalid fd', 8 /* WasiErrno.EBADF */);
        }
        const dstEntry = this.fds[dst];
        const srcEntry = this.fds[src];
        if (!dstEntry || !srcEntry || dstEntry.id !== dst || srcEntry.id !== src) {
            throw new WasiError('Invalid fd', 8 /* WasiErrno.EBADF */);
        }
        this.fs.closeSync(dstEntry.fd);
        this.fds[dst] = this.fds[src];
        this.fds[dst].id = dst;
        this.fds[src] = undefined;
        this.used--;
    }
}
class AsyncTable extends FileDescriptorTable {
    // eslint-disable-next-line @typescript-eslint/no-useless-constructor
    constructor(options) {
        super(options);
    }
    async getFileTypeByFd(fd) {
        const stats = await fd.stat({ bigint: true });
        return toFileType(stats);
    }
    async insertPreopen(fd, mappedPath, realPath) {
        const type = await this.getFileTypeByFd(fd);
        if (type !== 3 /* WasiFileType.DIRECTORY */) {
            throw new WasiError(`Preopen not dir: ["${mappedPath}", "${realPath}"]`, 54 /* WasiErrno.ENOTDIR */);
        }
        const result = getRights(this.stdio, fd.fd, 0, type);
        return this.insert(fd, mappedPath, realPath, type, result.base, result.inheriting, 1);
    }
    async renumber(dst, src) {
        if (dst === src)
            return;
        if (dst >= this.size || src >= this.size) {
            throw new WasiError('Invalid fd', 8 /* WasiErrno.EBADF */);
        }
        const dstEntry = this.fds[dst];
        const srcEntry = this.fds[src];
        if (!dstEntry || !srcEntry || dstEntry.id !== dst || srcEntry.id !== src) {
            throw new WasiError('Invalid fd', 8 /* WasiErrno.EBADF */);
        }
        await dstEntry.fd.close();
        this.fds[dst] = this.fds[src];
        this.fds[dst].id = dst;
        this.fds[src] = undefined;
        this.used--;
    }
}

/** @public */
const WebAssemblyMemory = /*#__PURE__*/ (function () { return _WebAssembly.Memory; })();
/** @public */
class Memory extends WebAssemblyMemory {
    // eslint-disable-next-line @typescript-eslint/no-useless-constructor
    constructor(descriptor) {
        super(descriptor);
    }
    get HEAP8() { return new Int8Array(super.buffer); }
    get HEAPU8() { return new Uint8Array(super.buffer); }
    get HEAP16() { return new Int16Array(super.buffer); }
    get HEAPU16() { return new Uint16Array(super.buffer); }
    get HEAP32() { return new Int32Array(super.buffer); }
    get HEAPU32() { return new Uint32Array(super.buffer); }
    get HEAP64() { return new BigInt64Array(super.buffer); }
    get HEAPU64() { return new BigUint64Array(super.buffer); }
    get HEAPF32() { return new Float32Array(super.buffer); }
    get HEAPF64() { return new Float64Array(super.buffer); }
    get view() { return new DataView(super.buffer); }
}
/** @public */
function extendMemory(memory) {
    if (Object.getPrototypeOf(memory) === _WebAssembly.Memory.prototype) {
        Object.setPrototypeOf(memory, Memory.prototype);
    }
    return memory;
}

function checkWebAssemblyFunction() {
    const WebAssemblyFunction = _WebAssembly.Function;
    if (typeof WebAssemblyFunction !== 'function') {
        throw new Error('WebAssembly.Function is not supported in this environment.' +
            ' If you are using V8 based browser like Chrome, try to specify' +
            ' --js-flags="--wasm-staging --experimental-wasm-stack-switching"');
    }
    return WebAssemblyFunction;
}
/** @public */
function wrapAsyncImport(f, parameterType, returnType) {
    const WebAssemblyFunction = checkWebAssemblyFunction();
    if (typeof f !== 'function') {
        throw new TypeError('Function required');
    }
    const parameters = parameterType.slice(0);
    parameters.unshift('externref');
    return new WebAssemblyFunction({ parameters, results: returnType }, f, { suspending: 'first' });
}

function copyMemory(targets, src) {
    if (targets.length === 0 || src.length === 0)
        return 0;
    let copied = 0;
    let left = src.length - copied;
    for (let i = 0; i < targets.length; ++i) {
        const target = targets[i];
        if (left < target.length) {
            target.set(src.subarray(copied, copied + left), 0);
            copied += left;
            left = 0;
            return copied;
        }
        target.set(src.subarray(copied, copied + target.length), 0);
        copied += target.length;
        left -= target.length;
    }
    return copied;
}
const _memory = new WeakMap();
const _wasi = new WeakMap();
const _fs = new WeakMap();
function getMemory(wasi) {
    return _memory.get(wasi);
}
function getFs(wasi) {
    const fs = _fs.get(wasi);
    if (!fs)
        throw new Error('filesystem is unavailable');
    return fs;
}
function handleError(err) {
    if (err instanceof WasiError) {
        return err.errno;
    }
    switch (err.code) {
        case 'ENOENT': return 44 /* WasiErrno.ENOENT */;
        case 'EBADF': return 8 /* WasiErrno.EBADF */;
        case 'EINVAL': return 28 /* WasiErrno.EINVAL */;
        case 'EPERM': return 63 /* WasiErrno.EPERM */;
        case 'EPROTO': return 65 /* WasiErrno.EPROTO */;
        case 'EEXIST': return 20 /* WasiErrno.EEXIST */;
        case 'ENOTDIR': return 54 /* WasiErrno.ENOTDIR */;
        case 'EMFILE': return 33 /* WasiErrno.EMFILE */;
        case 'EACCES': return 2 /* WasiErrno.EACCES */;
        case 'EISDIR': return 31 /* WasiErrno.EISDIR */;
        case 'ENOTEMPTY': return 55 /* WasiErrno.ENOTEMPTY */;
        case 'ENOSYS': return 52 /* WasiErrno.ENOSYS */;
    }
    throw err;
}
function defineName(name, f) {
    Object.defineProperty(f, 'name', { value: name });
    return f;
}
function syscallWrap(self, name, f) {
    return defineName(name, function () {
        let r;
        try {
            r = f.apply(self, arguments);
        }
        catch (err) {
            return handleError(err);
        }
        if (isPromiseLike(r)) {
            return r.then(_ => _, handleError);
        }
        return r;
    });
}
function resolvePathSync(fs, fileDescriptor, path, flags) {
    let resolvedPath = resolve(fileDescriptor.realPath, path);
    if ((flags & 1) === 1) {
        try {
            resolvedPath = fs.readlinkSync(resolvedPath);
        }
        catch (err) {
            if (err.code !== 'EINVAL' && err.code !== 'ENOENT') {
                throw err;
            }
        }
    }
    return resolvedPath;
}
async function resolvePathAsync(fs, fileDescriptor, path, flags) {
    let resolvedPath = resolve(fileDescriptor.realPath, path);
    if ((flags & 1) === 1) {
        try {
            resolvedPath = await fs.promises.readlink(resolvedPath);
        }
        catch (err) {
            if (err.code !== 'EINVAL' && err.code !== 'ENOENT') {
                throw err;
            }
        }
    }
    return resolvedPath;
}
// eslint-disable-next-line spaced-comment
const encoder = /*#__PURE__*/ new TextEncoder();
// eslint-disable-next-line spaced-comment
const decoder = /*#__PURE__*/ new TextDecoder();
const INT64_MAX = (BigInt(1) << BigInt(63)) - BigInt(1);
function readStdin() {
    const value = window.prompt();
    if (value === null)
        return new Uint8Array();
    const buffer = new TextEncoder().encode(value + '\n');
    return buffer;
}
function validateFstFlagsOrReturn(flags) {
    return (Boolean((flags) & ~(1 /* WasiFstFlag.SET_ATIM */ | 2 /* WasiFstFlag.SET_ATIM_NOW */ |
        4 /* WasiFstFlag.SET_MTIM */ | 8 /* WasiFstFlag.SET_MTIM_NOW */)) ||
        ((flags) & (1 /* WasiFstFlag.SET_ATIM */ | 2 /* WasiFstFlag.SET_ATIM_NOW */)) ===
            (1 /* WasiFstFlag.SET_ATIM */ | 2 /* WasiFstFlag.SET_ATIM_NOW */) ||
        ((flags) & (4 /* WasiFstFlag.SET_MTIM */ | 8 /* WasiFstFlag.SET_MTIM_NOW */)) ===
            (4 /* WasiFstFlag.SET_MTIM */ | 8 /* WasiFstFlag.SET_MTIM_NOW */));
}
class WASI$1 {
    constructor(args, env, fds, asyncFs, fs, asyncify) {
        this.args_get = syscallWrap(this, 'args_get', function (argv, argv_buf) {
            argv = Number(argv);
            argv_buf = Number(argv_buf);
            if (argv === 0 || argv_buf === 0) {
                return 28 /* WasiErrno.EINVAL */;
            }
            const { HEAPU8, view } = getMemory(this);
            const wasi = _wasi.get(this);
            const args = wasi.args;
            for (let i = 0; i < args.length; ++i) {
                const arg = args[i];
                view.setInt32(argv, argv_buf, true);
                argv += 4;
                const data = encoder.encode(arg + '\0');
                HEAPU8.set(data, argv_buf);
                argv_buf += data.length;
            }
            return 0 /* WasiErrno.ESUCCESS */;
        });
        this.args_sizes_get = syscallWrap(this, 'args_sizes_get', function (argc, argv_buf_size) {
            argc = Number(argc);
            argv_buf_size = Number(argv_buf_size);
            if (argc === 0 || argv_buf_size === 0) {
                return 28 /* WasiErrno.EINVAL */;
            }
            const { view } = getMemory(this);
            const wasi = _wasi.get(this);
            const args = wasi.args;
            view.setUint32(argc, args.length, true);
            view.setUint32(argv_buf_size, encoder.encode(args.join('\0') + '\0').length, true);
            return 0 /* WasiErrno.ESUCCESS */;
        });
        this.environ_get = syscallWrap(this, 'environ_get', function (environ, environ_buf) {
            environ = Number(environ);
            environ_buf = Number(environ_buf);
            if (environ === 0 || environ_buf === 0) {
                return 28 /* WasiErrno.EINVAL */;
            }
            const { HEAPU8, view } = getMemory(this);
            const wasi = _wasi.get(this);
            const env = wasi.env;
            for (let i = 0; i < env.length; ++i) {
                const pair = env[i];
                view.setInt32(environ, environ_buf, true);
                environ += 4;
                const data = encoder.encode(pair + '\0');
                HEAPU8.set(data, environ_buf);
                environ_buf += data.length;
            }
            return 0 /* WasiErrno.ESUCCESS */;
        });
        this.environ_sizes_get = syscallWrap(this, 'environ_sizes_get', function (len, buflen) {
            len = Number(len);
            buflen = Number(buflen);
            if (len === 0 || buflen === 0) {
                return 28 /* WasiErrno.EINVAL */;
            }
            const { view } = getMemory(this);
            const wasi = _wasi.get(this);
            view.setUint32(len, wasi.env.length, true);
            view.setUint32(buflen, encoder.encode(wasi.env.join('\0') + '\0').length, true);
            return 0 /* WasiErrno.ESUCCESS */;
        });
        this.clock_res_get = syscallWrap(this, 'clock_res_get', function (id, resolution) {
            resolution = Number(resolution);
            if (resolution === 0) {
                return 28 /* WasiErrno.EINVAL */;
            }
            const { view } = getMemory(this);
            switch (id) {
                case 0 /* WasiClockid.REALTIME */:
                    view.setBigUint64(resolution, BigInt(1000000), true);
                    return 0 /* WasiErrno.ESUCCESS */;
                case 1 /* WasiClockid.MONOTONIC */:
                case 2 /* WasiClockid.PROCESS_CPUTIME_ID */:
                case 3 /* WasiClockid.THREAD_CPUTIME_ID */:
                    view.setBigUint64(resolution, BigInt(1000), true);
                    return 0 /* WasiErrno.ESUCCESS */;
                default: return 28 /* WasiErrno.EINVAL */;
            }
        });
        this.clock_time_get = syscallWrap(this, 'clock_time_get', function (id, _percision, time) {
            time = Number(time);
            if (time === 0) {
                return 28 /* WasiErrno.EINVAL */;
            }
            const { view } = getMemory(this);
            switch (id) {
                case 0 /* WasiClockid.REALTIME */:
                    view.setBigUint64(time, BigInt(Date.now()) * BigInt(1000000), true);
                    return 0 /* WasiErrno.ESUCCESS */;
                case 1 /* WasiClockid.MONOTONIC */:
                case 2 /* WasiClockid.PROCESS_CPUTIME_ID */:
                case 3 /* WasiClockid.THREAD_CPUTIME_ID */: {
                    const t = performance.now();
                    const s = Math.trunc(t);
                    const ms = Math.floor((t - s) * 1000);
                    const result = BigInt(s) * BigInt(1000000000) + BigInt(ms) * BigInt(1000000);
                    view.setBigUint64(time, result, true);
                    return 0 /* WasiErrno.ESUCCESS */;
                }
                default: return 28 /* WasiErrno.EINVAL */;
            }
        });
        this.fd_advise = syscallWrap(this, 'fd_advise', function (_fd, _offset, _len, _advice) {
            return 52 /* WasiErrno.ENOSYS */;
        });
        this.fd_fdstat_get = syscallWrap(this, 'fd_fdstat_get', function (fd, fdstat) {
            fdstat = Number(fdstat);
            if (fdstat === 0) {
                return 28 /* WasiErrno.EINVAL */;
            }
            const wasi = _wasi.get(this);
            const fileDescriptor = wasi.fds.get(fd, BigInt(0), BigInt(0));
            const { view } = getMemory(this);
            view.setUint16(fdstat, fileDescriptor.type, true);
            view.setUint16(fdstat + 2, 0, true);
            view.setBigUint64(fdstat + 8, fileDescriptor.rightsBase, true);
            view.setBigUint64(fdstat + 16, fileDescriptor.rightsInheriting, true);
            return 0 /* WasiErrno.ESUCCESS */;
        });
        this.fd_fdstat_set_flags = syscallWrap(this, 'fd_fdstat_set_flags', function (_fd, _flags) {
            return 52 /* WasiErrno.ENOSYS */;
        });
        this.fd_fdstat_set_rights = syscallWrap(this, 'fd_fdstat_set_rights', function (fd, rightsBase, rightsInheriting) {
            const wasi = _wasi.get(this);
            const fileDescriptor = wasi.fds.get(fd, BigInt(0), BigInt(0));
            if ((rightsBase | fileDescriptor.rightsBase) > fileDescriptor.rightsBase) {
                return 76 /* WasiErrno.ENOTCAPABLE */;
            }
            if ((rightsInheriting | fileDescriptor.rightsInheriting) >
                fileDescriptor.rightsInheriting) {
                return 76 /* WasiErrno.ENOTCAPABLE */;
            }
            fileDescriptor.rightsBase = rightsBase;
            fileDescriptor.rightsInheriting = rightsInheriting;
            return 0 /* WasiErrno.ESUCCESS */;
        });
        this.fd_prestat_get = syscallWrap(this, 'fd_prestat_get', function (fd, prestat) {
            prestat = Number(prestat);
            if (prestat === 0) {
                return 28 /* WasiErrno.EINVAL */;
            }
            const wasi = _wasi.get(this);
            let fileDescriptor;
            try {
                fileDescriptor = wasi.fds.get(fd, BigInt(0), BigInt(0));
            }
            catch (err) {
                if (err instanceof WasiError)
                    return err.errno;
                throw err;
            }
            if (fileDescriptor.preopen !== 1)
                return 28 /* WasiErrno.EINVAL */;
            const { view } = getMemory(this);
            // preopen type is dir(0)
            view.setUint32(prestat, 0, true);
            view.setUint32(prestat + 4, encoder.encode(fileDescriptor.path).length, true);
            return 0 /* WasiErrno.ESUCCESS */;
        });
        this.fd_prestat_dir_name = syscallWrap(this, 'fd_prestat_dir_name', function (fd, path, path_len) {
            path = Number(path);
            path_len = Number(path_len);
            if (path === 0) {
                return 28 /* WasiErrno.EINVAL */;
            }
            const wasi = _wasi.get(this);
            const fileDescriptor = wasi.fds.get(fd, BigInt(0), BigInt(0));
            if (fileDescriptor.preopen !== 1)
                return 8 /* WasiErrno.EBADF */;
            const buffer = encoder.encode(fileDescriptor.path);
            const size = buffer.length;
            if (size > path_len)
                return 42 /* WasiErrno.ENOBUFS */;
            const { HEAPU8 } = getMemory(this);
            HEAPU8.set(buffer, path);
            return 0 /* WasiErrno.ESUCCESS */;
        });
        this.fd_seek = syscallWrap(this, 'fd_seek', function (fd, offset, whence, newOffset) {
            newOffset = Number(newOffset);
            if (newOffset === 0) {
                return 28 /* WasiErrno.EINVAL */;
            }
            if (fd === 0 || fd === 1 || fd === 2)
                return 0 /* WasiErrno.ESUCCESS */;
            const wasi = _wasi.get(this);
            const fileDescriptor = wasi.fds.get(fd, WasiRights.FD_SEEK, BigInt(0));
            const r = fileDescriptor.seek(offset, whence);
            const { view } = getMemory(this);
            view.setBigUint64(newOffset, r, true);
            return 0 /* WasiErrno.ESUCCESS */;
        });
        this.fd_tell = syscallWrap(this, 'fd_tell', function (fd, offset) {
            const wasi = _wasi.get(this);
            const fileDescriptor = wasi.fds.get(fd, WasiRights.FD_TELL, BigInt(0));
            const pos = BigInt(fileDescriptor.pos);
            const { view } = getMemory(this);
            view.setBigUint64(Number(offset), pos, true);
            return 0 /* WasiErrno.ESUCCESS */;
        });
        this.poll_oneoff = syscallWrap(this, 'poll_oneoff', function (in_ptr, out_ptr, nsubscriptions, nevents) {
            in_ptr = Number(in_ptr);
            out_ptr = Number(out_ptr);
            nevents = Number(nevents);
            nsubscriptions = Number(nsubscriptions);
            nsubscriptions = nsubscriptions >>> 0;
            if (in_ptr === 0 || out_ptr === 0 || nsubscriptions === 0 || nevents === 0) {
                return 28 /* WasiErrno.EINVAL */;
            }
            const { view } = getMemory(this);
            view.setUint32(nevents, 0, true);
            let i = 0;
            let timer_userdata = BigInt(0);
            let cur_timeout = BigInt(0);
            let has_timeout = 0;
            let min_timeout = BigInt(0);
            let sub;
            const subscriptions = Array(nsubscriptions);
            for (i = 0; i < nsubscriptions; i++) {
                sub = in_ptr + i * 48;
                const userdata = view.getBigUint64(sub, true);
                const type = view.getUint8(sub + 8);
                const clockIdOrFd = view.getUint32(sub + 16, true);
                const timeout = view.getBigUint64(sub + 24, true);
                const precision = view.getBigUint64(sub + 32, true);
                const flags = view.getUint16(sub + 40, true);
                subscriptions[i] = {
                    userdata,
                    type,
                    u: {
                        clock: {
                            clock_id: clockIdOrFd,
                            timeout,
                            precision,
                            flags
                        },
                        fd_readwrite: {
                            fd: clockIdOrFd
                        }
                    }
                };
            }
            const fdevents = [];
            for (i = 0; i < nsubscriptions; i++) {
                sub = subscriptions[i];
                switch (sub.type) {
                    case 0 /* WasiEventType.CLOCK */: {
                        if (sub.u.clock.flags === 1 /* WasiSubclockflags.ABSTIME */) {
                            /* Convert absolute time to relative delay. */
                            const now = BigInt(Date.now()) * BigInt(1000000);
                            cur_timeout = sub.u.clock.timeout - now;
                        }
                        else {
                            cur_timeout = sub.u.clock.timeout;
                        }
                        if (has_timeout === 0 || cur_timeout < min_timeout) {
                            min_timeout = cur_timeout;
                            timer_userdata = sub.userdata;
                            has_timeout = 1;
                        }
                        break;
                    }
                    case 1 /* WasiEventType.FD_READ */:
                    case 2 /* WasiEventType.FD_WRITE */:
                        fdevents.push(sub);
                        break;
                    default: return 28 /* WasiErrno.EINVAL */;
                }
            }
            if (fdevents.length > 0) {
                for (i = 0; i < fdevents.length; i++) {
                    const fdevent = fdevents[i];
                    const event = out_ptr + 32 * i;
                    view.setBigUint64(event, fdevent.userdata, true);
                    view.setUint32(event + 8, 52 /* WasiErrno.ENOSYS */, true);
                    view.setUint32(event + 12, fdevent.type, true);
                    view.setBigUint64(event + 16, BigInt(0), true);
                    view.setUint16(event + 24, 0, true);
                    view.setUint32(nevents, 1, true);
                }
                view.setUint32(nevents, fdevents.length, true);
                return 0 /* WasiErrno.ESUCCESS */;
            }
            if (has_timeout) {
                Number(min_timeout / BigInt(1000000));
                // } else {
                //   const buf = new SharedArrayBuffer(4)
                //   const arr = new Int32Array(buf)
                //   postMsg({
                //     __tybys_wasm_util_wasi__: {
                //       type: 'set-timeout',
                //       payload: {
                //         buffer: buf,
                //         delay
                //       }
                //     }
                //   })
                //   Atomics.wait(arr, 0, 0)
                // }
                const event = out_ptr;
                view.setBigUint64(event, timer_userdata, true);
                view.setUint32(event + 8, 0 /* WasiErrno.ESUCCESS */, true);
                view.setUint32(event + 12, 0 /* WasiEventType.CLOCK */, true);
                view.setUint32(nevents, 1, true);
            }
            return 0 /* WasiErrno.ESUCCESS */;
        });
        this.proc_exit = syscallWrap(this, 'proc_exit', function (rval) {
            return 0 /* WasiErrno.ESUCCESS */;
        });
        this.proc_raise = syscallWrap(this, 'proc_raise', function (_sig) {
            return 52 /* WasiErrno.ENOSYS */;
        });
        this.sched_yield = syscallWrap(this, 'sched_yield', function () {
            return 0 /* WasiErrno.ESUCCESS */;
        });
        this.random_get = typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function'
            ? syscallWrap(this, 'random_get', function (buf, buf_len) {
                buf = Number(buf);
                if (buf === 0) {
                    return 28 /* WasiErrno.EINVAL */;
                }
                buf_len = Number(buf_len);
                const { HEAPU8, view } = getMemory(this);
                if ((typeof SharedArrayBuffer === 'function' && HEAPU8.buffer instanceof SharedArrayBuffer) ||
                    (Object.prototype.toString.call(HEAPU8.buffer) === '[object SharedArrayBuffer]')) {
                    for (let i = buf; i < buf + buf_len; ++i) {
                        view.setUint8(i, Math.floor(Math.random() * 256));
                    }
                    return 0 /* WasiErrno.ESUCCESS */;
                }
                let pos;
                const stride = 65536;
                for (pos = 0; pos + stride < buf_len; pos += stride) {
                    crypto.getRandomValues(HEAPU8.subarray(buf + pos, buf + pos + stride));
                }
                crypto.getRandomValues(HEAPU8.subarray(buf + pos, buf + buf_len));
                return 0 /* WasiErrno.ESUCCESS */;
            })
            : syscallWrap(this, 'random_get', function (buf, buf_len) {
                buf = Number(buf);
                if (buf === 0) {
                    return 28 /* WasiErrno.EINVAL */;
                }
                buf_len = Number(buf_len);
                const { view } = getMemory(this);
                for (let i = buf; i < buf + buf_len; ++i) {
                    view.setUint8(i, Math.floor(Math.random() * 256));
                }
                return 0 /* WasiErrno.ESUCCESS */;
            });
        this.sock_recv = syscallWrap(this, 'sock_recv', function () {
            return 58 /* WasiErrno.ENOTSUP */;
        });
        this.sock_send = syscallWrap(this, 'sock_send', function () {
            return 58 /* WasiErrno.ENOTSUP */;
        });
        this.sock_shutdown = syscallWrap(this, 'sock_shutdown', function () {
            return 58 /* WasiErrno.ENOTSUP */;
        });
        this.sock_accept = syscallWrap(this, 'sock_accept', function () {
            return 58 /* WasiErrno.ENOTSUP */;
        });
        _wasi.set(this, {
            fds,
            args,
            env
        });
        if (fs)
            _fs.set(this, fs);
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const _this = this;
        function defineImport(name, syncVersion, asyncVersion, parameterType, returnType) {
            if (asyncFs) {
                if (asyncify) {
                    _this[name] = asyncify.wrapImportFunction(syscallWrap(_this, name, asyncVersion));
                }
                else {
                    _this[name] = wrapAsyncImport(syscallWrap(_this, name, asyncVersion), parameterType, returnType);
                }
            }
            else {
                _this[name] = syscallWrap(_this, name, syncVersion);
            }
        }
        defineImport('fd_allocate', function fd_allocate(fd, offset, len) {
            const wasi = _wasi.get(this);
            const fs = getFs(this);
            const fileDescriptor = wasi.fds.get(fd, WasiRights.FD_ALLOCATE, BigInt(0));
            const stat = fs.fstatSync(fileDescriptor.fd, { bigint: true });
            if (stat.size < offset + len) {
                fs.ftruncateSync(fileDescriptor.fd, Number(offset + len));
            }
            return 0 /* WasiErrno.ESUCCESS */;
        }, async function fd_allocate(fd, offset, len) {
            const wasi = _wasi.get(this);
            const fileDescriptor = wasi.fds.get(fd, WasiRights.FD_ALLOCATE, BigInt(0));
            const h = fileDescriptor.fd;
            const stat = await h.stat({ bigint: true });
            if (stat.size < offset + len) {
                await h.truncate(Number(offset + len));
            }
            return 0 /* WasiErrno.ESUCCESS */;
        }, ['i32', 'i64', 'f64'], ['i32']);
        defineImport('fd_close', function fd_close(fd) {
            const wasi = _wasi.get(this);
            const fileDescriptor = wasi.fds.get(fd, BigInt(0), BigInt(0));
            const fs = getFs(this);
            fs.closeSync(fileDescriptor.fd);
            wasi.fds.remove(fd);
            return 0 /* WasiErrno.ESUCCESS */;
        }, async function fd_close(fd) {
            const wasi = _wasi.get(this);
            const fileDescriptor = wasi.fds.get(fd, BigInt(0), BigInt(0));
            await fileDescriptor.fd.close();
            wasi.fds.remove(fd);
            return 0 /* WasiErrno.ESUCCESS */;
        }, ['i32'], ['i32']);
        defineImport('fd_datasync', function fd_datasync(fd) {
            const wasi = _wasi.get(this);
            const fileDescriptor = wasi.fds.get(fd, WasiRights.FD_DATASYNC, BigInt(0));
            const fs = getFs(this);
            fs.fdatasyncSync(fileDescriptor.fd);
            return 0 /* WasiErrno.ESUCCESS */;
        }, async function fd_datasync(fd) {
            const wasi = _wasi.get(this);
            const fileDescriptor = wasi.fds.get(fd, WasiRights.FD_DATASYNC, BigInt(0));
            await fileDescriptor.fd.datasync();
            return 0 /* WasiErrno.ESUCCESS */;
        }, ['i32'], ['i32']);
        defineImport('fd_filestat_get', function fd_filestat_get(fd, buf) {
            buf = Number(buf);
            if (buf === 0)
                return 28 /* WasiErrno.EINVAL */;
            const wasi = _wasi.get(this);
            const fileDescriptor = wasi.fds.get(fd, WasiRights.FD_FILESTAT_GET, BigInt(0));
            const fs = getFs(this);
            const stat = fs.fstatSync(fileDescriptor.fd, { bigint: true });
            const { view } = getMemory(this);
            toFileStat(view, buf, stat);
            return 0 /* WasiErrno.ESUCCESS */;
        }, async function fd_filestat_get(fd, buf) {
            buf = Number(buf);
            if (buf === 0)
                return 28 /* WasiErrno.EINVAL */;
            const wasi = _wasi.get(this);
            const fileDescriptor = wasi.fds.get(fd, WasiRights.FD_FILESTAT_GET, BigInt(0));
            const h = fileDescriptor.fd;
            const stat = await h.stat({ bigint: true });
            const { view } = getMemory(this);
            toFileStat(view, buf, stat);
            return 0 /* WasiErrno.ESUCCESS */;
        }, ['i32', 'i32'], ['i32']);
        defineImport('fd_filestat_set_size', function fd_filestat_set_size(fd, size) {
            const wasi = _wasi.get(this);
            const fileDescriptor = wasi.fds.get(fd, WasiRights.FD_FILESTAT_SET_SIZE, BigInt(0));
            const fs = getFs(this);
            fs.ftruncateSync(fileDescriptor.fd, Number(size));
            return 0 /* WasiErrno.ESUCCESS */;
        }, async function fd_filestat_set_size(fd, size) {
            const wasi = _wasi.get(this);
            const fileDescriptor = wasi.fds.get(fd, WasiRights.FD_FILESTAT_SET_SIZE, BigInt(0));
            const h = fileDescriptor.fd;
            await h.truncate(Number(size));
            return 0 /* WasiErrno.ESUCCESS */;
        }, ['i32', 'i64'], ['i32']);
        function fdFilestatGetTimes(fd, atim, mtim, flags) {
            const wasi = _wasi.get(this);
            const fileDescriptor = wasi.fds.get(fd, WasiRights.FD_FILESTAT_SET_TIMES, BigInt(0));
            if ((flags & 2 /* WasiFstFlag.SET_ATIM_NOW */) === 2 /* WasiFstFlag.SET_ATIM_NOW */) {
                atim = BigInt(Date.now() * 1000000);
            }
            if ((flags & 8 /* WasiFstFlag.SET_MTIM_NOW */) === 8 /* WasiFstFlag.SET_MTIM_NOW */) {
                mtim = BigInt(Date.now() * 1000000);
            }
            return { fileDescriptor, atim, mtim };
        }
        defineImport('fd_filestat_set_times', function fd_filestat_set_times(fd, atim, mtim, flags) {
            if (validateFstFlagsOrReturn(flags)) {
                return 28 /* WasiErrno.EINVAL */;
            }
            const { fileDescriptor, atim: atimRes, mtim: mtimRes } = fdFilestatGetTimes.call(this, fd, atim, mtim, flags);
            const fs = getFs(this);
            fs.futimesSync(fileDescriptor.fd, Number(atimRes), Number(mtimRes));
            return 0 /* WasiErrno.ESUCCESS */;
        }, async function fd_filestat_set_times(fd, atim, mtim, flags) {
            if (validateFstFlagsOrReturn(flags)) {
                return 28 /* WasiErrno.EINVAL */;
            }
            const { fileDescriptor, atim: atimRes, mtim: mtimRes } = fdFilestatGetTimes.call(this, fd, atim, mtim, flags);
            const h = fileDescriptor.fd;
            await h.utimes(Number(atimRes), Number(mtimRes));
            return 0 /* WasiErrno.ESUCCESS */;
        }, ['i32', 'i64', 'i64', 'i32'], ['i32']);
        defineImport('fd_pread', function fd_pread(fd, iovs, iovslen, offset, size) {
            iovs = Number(iovs);
            size = Number(size);
            if ((iovs === 0 && iovslen) || size === 0 || offset > INT64_MAX) {
                return 28 /* WasiErrno.EINVAL */;
            }
            const { HEAPU8, view } = getMemory(this);
            const wasi = _wasi.get(this);
            const fileDescriptor = wasi.fds.get(fd, WasiRights.FD_READ | WasiRights.FD_SEEK, BigInt(0));
            if (!iovslen) {
                view.setUint32(size, 0, true);
                return 0 /* WasiErrno.ESUCCESS */;
            }
            let totalSize = 0;
            const ioVecs = Array.from({ length: Number(iovslen) }, (_, i) => {
                const offset = iovs + (i * 8);
                const buf = view.getInt32(offset, true);
                const bufLen = view.getUint32(offset + 4, true);
                totalSize += bufLen;
                return HEAPU8.subarray(buf, buf + bufLen);
            });
            let nread = 0;
            const buffer = (() => {
                try {
                    return new Uint8Array(new SharedArrayBuffer(totalSize));
                }
                catch (_) {
                    return new Uint8Array(totalSize);
                }
            })();
            buffer._isBuffer = true;
            const fs = getFs(this);
            const bytesRead = fs.readSync(fileDescriptor.fd, buffer, 0, buffer.length, Number(offset));
            nread = buffer ? copyMemory(ioVecs, buffer.subarray(0, bytesRead)) : 0;
            view.setUint32(size, nread, true);
            return 0 /* WasiErrno.ESUCCESS */;
        }, async function (fd, iovs, iovslen, offset, size) {
            iovs = Number(iovs);
            size = Number(size);
            if ((iovs === 0 && iovslen) || size === 0 || offset > INT64_MAX) {
                return 28 /* WasiErrno.EINVAL */;
            }
            const { HEAPU8, view } = getMemory(this);
            const wasi = _wasi.get(this);
            const fileDescriptor = wasi.fds.get(fd, WasiRights.FD_READ | WasiRights.FD_SEEK, BigInt(0));
            if (!iovslen) {
                view.setUint32(size, 0, true);
                return 0 /* WasiErrno.ESUCCESS */;
            }
            let totalSize = 0;
            const ioVecs = Array.from({ length: Number(iovslen) }, (_, i) => {
                const offset = iovs + (i * 8);
                const buf = view.getInt32(offset, true);
                const bufLen = view.getUint32(offset + 4, true);
                totalSize += bufLen;
                return HEAPU8.subarray(buf, buf + bufLen);
            });
            let nread = 0;
            const buffer = new Uint8Array(totalSize);
            buffer._isBuffer = true;
            const { bytesRead } = await fileDescriptor.fd.read(buffer, 0, buffer.length, Number(offset));
            nread = buffer ? copyMemory(ioVecs, buffer.subarray(0, bytesRead)) : 0;
            view.setUint32(size, nread, true);
            return 0 /* WasiErrno.ESUCCESS */;
        }, ['i32', 'i32', 'i32', 'i64', 'i32'], ['i32']);
        defineImport('fd_pwrite', function fd_pwrite(fd, iovs, iovslen, offset, size) {
            iovs = Number(iovs);
            size = Number(size);
            if ((iovs === 0 && iovslen) || size === 0 || offset > INT64_MAX) {
                return 28 /* WasiErrno.EINVAL */;
            }
            const { HEAPU8, view } = getMemory(this);
            const wasi = _wasi.get(this);
            const fileDescriptor = wasi.fds.get(fd, WasiRights.FD_WRITE | WasiRights.FD_SEEK, BigInt(0));
            if (!iovslen) {
                view.setUint32(size, 0, true);
                return 0 /* WasiErrno.ESUCCESS */;
            }
            const buffer = concatBuffer(Array.from({ length: Number(iovslen) }, (_, i) => {
                const offset = iovs + (i * 8);
                const buf = view.getInt32(offset, true);
                const bufLen = view.getUint32(offset + 4, true);
                return HEAPU8.subarray(buf, buf + bufLen);
            }));
            const fs = getFs(this);
            const nwritten = fs.writeSync(fileDescriptor.fd, buffer, 0, buffer.length, Number(offset));
            view.setUint32(size, nwritten, true);
            return 0 /* WasiErrno.ESUCCESS */;
        }, async function fd_pwrite(fd, iovs, iovslen, offset, size) {
            iovs = Number(iovs);
            size = Number(size);
            if ((iovs === 0 && iovslen) || size === 0 || offset > INT64_MAX) {
                return 28 /* WasiErrno.EINVAL */;
            }
            const { HEAPU8, view } = getMemory(this);
            const wasi = _wasi.get(this);
            const fileDescriptor = wasi.fds.get(fd, WasiRights.FD_WRITE | WasiRights.FD_SEEK, BigInt(0));
            if (!iovslen) {
                view.setUint32(size, 0, true);
                return 0 /* WasiErrno.ESUCCESS */;
            }
            const buffer = concatBuffer(Array.from({ length: Number(iovslen) }, (_, i) => {
                const offset = iovs + (i * 8);
                const buf = view.getInt32(offset, true);
                const bufLen = view.getUint32(offset + 4, true);
                return HEAPU8.subarray(buf, buf + bufLen);
            }));
            const { bytesWritten } = await fileDescriptor.fd.write(buffer, 0, buffer.length, Number(offset));
            view.setUint32(size, bytesWritten, true);
            return 0 /* WasiErrno.ESUCCESS */;
        }, ['i32', 'i32', 'i32', 'i64', 'i32'], ['i32']);
        defineImport('fd_read', function fd_read(fd, iovs, iovslen, size) {
            iovs = Number(iovs);
            size = Number(size);
            if ((iovs === 0 && iovslen) || size === 0) {
                return 28 /* WasiErrno.EINVAL */;
            }
            const { HEAPU8, view } = getMemory(this);
            const wasi = _wasi.get(this);
            const fileDescriptor = wasi.fds.get(fd, WasiRights.FD_READ, BigInt(0));
            if (!iovslen) {
                view.setUint32(size, 0, true);
                return 0 /* WasiErrno.ESUCCESS */;
            }
            let totalSize = 0;
            const ioVecs = Array.from({ length: Number(iovslen) }, (_, i) => {
                const offset = iovs + (i * 8);
                const buf = view.getInt32(offset, true);
                const bufLen = view.getUint32(offset + 4, true);
                totalSize += bufLen;
                return HEAPU8.subarray(buf, buf + bufLen);
            });
            let buffer;
            let nread = 0;
            if (fd === 0) {
                if (typeof window === 'undefined' || typeof window.prompt !== 'function') {
                    return 58 /* WasiErrno.ENOTSUP */;
                }
                buffer = readStdin();
                nread = buffer ? copyMemory(ioVecs, buffer) : 0;
            }
            else {
                buffer = (() => {
                    try {
                        return new Uint8Array(new SharedArrayBuffer(totalSize));
                    }
                    catch (_) {
                        return new Uint8Array(totalSize);
                    }
                })();
                buffer._isBuffer = true;
                const fs = getFs(this);
                const bytesRead = fs.readSync(fileDescriptor.fd, buffer, 0, buffer.length, Number(fileDescriptor.pos));
                nread = buffer ? copyMemory(ioVecs, buffer.subarray(0, bytesRead)) : 0;
                fileDescriptor.pos += BigInt(nread);
            }
            view.setUint32(size, nread, true);
            return 0 /* WasiErrno.ESUCCESS */;
        }, async function fd_read(fd, iovs, iovslen, size) {
            iovs = Number(iovs);
            size = Number(size);
            if ((iovs === 0 && iovslen) || size === 0) {
                return 28 /* WasiErrno.EINVAL */;
            }
            const { HEAPU8, view } = getMemory(this);
            const wasi = _wasi.get(this);
            const fileDescriptor = wasi.fds.get(fd, WasiRights.FD_READ, BigInt(0));
            if (!iovslen) {
                view.setUint32(size, 0, true);
                return 0 /* WasiErrno.ESUCCESS */;
            }
            let totalSize = 0;
            const ioVecs = Array.from({ length: Number(iovslen) }, (_, i) => {
                const offset = iovs + (i * 8);
                const buf = view.getInt32(offset, true);
                const bufLen = view.getUint32(offset + 4, true);
                totalSize += bufLen;
                return HEAPU8.subarray(buf, buf + bufLen);
            });
            let buffer;
            let nread = 0;
            if (fd === 0) {
                if (typeof window === 'undefined' || typeof window.prompt !== 'function') {
                    return 58 /* WasiErrno.ENOTSUP */;
                }
                buffer = readStdin();
                nread = buffer ? copyMemory(ioVecs, buffer) : 0;
            }
            else {
                buffer = new Uint8Array(totalSize);
                buffer._isBuffer = true;
                const { bytesRead } = await fileDescriptor.fd.read(buffer, 0, buffer.length, Number(fileDescriptor.pos));
                nread = buffer ? copyMemory(ioVecs, buffer.subarray(0, bytesRead)) : 0;
                fileDescriptor.pos += BigInt(nread);
            }
            view.setUint32(size, nread, true);
            return 0 /* WasiErrno.ESUCCESS */;
        }, ['i32', 'i32', 'i32', 'i32'], ['i32']);
        defineImport('fd_readdir', function fd_readdir(fd, buf, buf_len, cookie, bufused) {
            buf = Number(buf);
            buf_len = Number(buf_len);
            bufused = Number(bufused);
            if (buf === 0 || bufused === 0)
                return 0 /* WasiErrno.ESUCCESS */;
            const wasi = _wasi.get(this);
            const fileDescriptor = wasi.fds.get(fd, WasiRights.FD_READDIR, BigInt(0));
            const fs = getFs(this);
            const entries = fs.readdirSync(fileDescriptor.realPath, { withFileTypes: true });
            const { HEAPU8, view } = getMemory(this);
            let bufferUsed = 0;
            for (let i = Number(cookie); i < entries.length; i++) {
                const nameData = encoder.encode(entries[i].name);
                const entryInfo = fs.statSync(resolve(fileDescriptor.realPath, entries[i].name), { bigint: true });
                const entryData = new Uint8Array(24 + nameData.byteLength);
                const entryView = new DataView(entryData.buffer);
                entryView.setBigUint64(0, BigInt(i + 1), true);
                entryView.setBigUint64(8, BigInt(entryInfo.ino ? entryInfo.ino : 0), true);
                entryView.setUint32(16, nameData.byteLength, true);
                let type;
                if (entries[i].isFile()) {
                    type = 4 /* WasiFileType.REGULAR_FILE */;
                }
                else if (entries[i].isDirectory()) {
                    type = 3 /* WasiFileType.DIRECTORY */;
                }
                else if (entries[i].isSymbolicLink()) {
                    type = 7 /* WasiFileType.SYMBOLIC_LINK */;
                }
                else if (entries[i].isCharacterDevice()) {
                    type = 2 /* WasiFileType.CHARACTER_DEVICE */;
                }
                else if (entries[i].isBlockDevice()) {
                    type = 1 /* WasiFileType.BLOCK_DEVICE */;
                }
                else if (entries[i].isSocket()) {
                    type = 6 /* WasiFileType.SOCKET_STREAM */;
                }
                else {
                    type = 0 /* WasiFileType.UNKNOWN */;
                }
                entryView.setUint8(20, type);
                entryData.set(nameData, 24);
                const data = entryData.slice(0, Math.min(entryData.length, buf_len - bufferUsed));
                HEAPU8.set(data, buf + bufferUsed);
                bufferUsed += data.byteLength;
            }
            view.setUint32(bufused, bufferUsed, true);
            return 0 /* WasiErrno.ESUCCESS */;
        }, async function fd_readdir(fd, buf, buf_len, cookie, bufused) {
            buf = Number(buf);
            buf_len = Number(buf_len);
            bufused = Number(bufused);
            if (buf === 0 || bufused === 0)
                return 0 /* WasiErrno.ESUCCESS */;
            const wasi = _wasi.get(this);
            const fileDescriptor = wasi.fds.get(fd, WasiRights.FD_READDIR, BigInt(0));
            const fs = getFs(this);
            const entries = await fs.promises.readdir(fileDescriptor.realPath, { withFileTypes: true });
            const { HEAPU8, view } = getMemory(this);
            let bufferUsed = 0;
            for (let i = Number(cookie); i < entries.length; i++) {
                const nameData = encoder.encode(entries[i].name);
                const entryInfo = await fs.promises.stat(resolve(fileDescriptor.realPath, entries[i].name), { bigint: true });
                const entryData = new Uint8Array(24 + nameData.byteLength);
                const entryView = new DataView(entryData.buffer);
                entryView.setBigUint64(0, BigInt(i + 1), true);
                entryView.setBigUint64(8, BigInt(entryInfo.ino ? entryInfo.ino : 0), true);
                entryView.setUint32(16, nameData.byteLength, true);
                let type;
                if (entries[i].isFile()) {
                    type = 4 /* WasiFileType.REGULAR_FILE */;
                }
                else if (entries[i].isDirectory()) {
                    type = 3 /* WasiFileType.DIRECTORY */;
                }
                else if (entries[i].isSymbolicLink()) {
                    type = 7 /* WasiFileType.SYMBOLIC_LINK */;
                }
                else if (entries[i].isCharacterDevice()) {
                    type = 2 /* WasiFileType.CHARACTER_DEVICE */;
                }
                else if (entries[i].isBlockDevice()) {
                    type = 1 /* WasiFileType.BLOCK_DEVICE */;
                }
                else if (entries[i].isSocket()) {
                    type = 6 /* WasiFileType.SOCKET_STREAM */;
                }
                else {
                    type = 0 /* WasiFileType.UNKNOWN */;
                }
                entryView.setUint8(20, type);
                entryData.set(nameData, 24);
                const data = entryData.slice(0, Math.min(entryData.length, buf_len - bufferUsed));
                HEAPU8.set(data, buf + bufferUsed);
                bufferUsed += data.byteLength;
            }
            view.setUint32(bufused, bufferUsed, true);
            return 0 /* WasiErrno.ESUCCESS */;
        }, ['i32', 'i32', 'i32', 'i64', 'i32'], ['i32']);
        defineImport('fd_renumber', function fd_renumber(from, to) {
            const wasi = _wasi.get(this);
            wasi.fds.renumber(to, from);
            return 0 /* WasiErrno.ESUCCESS */;
        }, async function fd_renumber(from, to) {
            const wasi = _wasi.get(this);
            await wasi.fds.renumber(to, from);
            return 0 /* WasiErrno.ESUCCESS */;
        }, ['i32', 'i32'], ['i32']);
        defineImport('fd_sync', function fd_sync(fd) {
            const wasi = _wasi.get(this);
            const fileDescriptor = wasi.fds.get(fd, WasiRights.FD_SYNC, BigInt(0));
            const fs = getFs(this);
            fs.fsyncSync(fileDescriptor.fd);
            return 0 /* WasiErrno.ESUCCESS */;
        }, async function fd_sync(fd) {
            const wasi = _wasi.get(this);
            const fileDescriptor = wasi.fds.get(fd, WasiRights.FD_SYNC, BigInt(0));
            await fileDescriptor.fd.sync();
            return 0 /* WasiErrno.ESUCCESS */;
        }, ['i32'], ['i32']);
        defineImport('fd_write', function fd_write(fd, iovs, iovslen, size) {
            iovs = Number(iovs);
            size = Number(size);
            if ((iovs === 0 && iovslen) || size === 0) {
                return 28 /* WasiErrno.EINVAL */;
            }
            const { HEAPU8, view } = getMemory(this);
            const wasi = _wasi.get(this);
            const fileDescriptor = wasi.fds.get(fd, WasiRights.FD_WRITE, BigInt(0));
            if (!iovslen) {
                view.setUint32(size, 0, true);
                return 0 /* WasiErrno.ESUCCESS */;
            }
            const buffer = concatBuffer(Array.from({ length: Number(iovslen) }, (_, i) => {
                const offset = iovs + (i * 8);
                const buf = view.getInt32(offset, true);
                const bufLen = view.getUint32(offset + 4, true);
                return HEAPU8.subarray(buf, buf + bufLen);
            }));
            let nwritten;
            if (fd === 1 || fd === 2) {
                nwritten = fileDescriptor.write(buffer);
            }
            else {
                const fs = getFs(this);
                nwritten = fs.writeSync(fileDescriptor.fd, buffer, 0, buffer.length, Number(fileDescriptor.pos));
                fileDescriptor.pos += BigInt(nwritten);
            }
            view.setUint32(size, nwritten, true);
            return 0 /* WasiErrno.ESUCCESS */;
        }, async function fd_write(fd, iovs, iovslen, size) {
            iovs = Number(iovs);
            size = Number(size);
            if ((iovs === 0 && iovslen) || size === 0) {
                return 28 /* WasiErrno.EINVAL */;
            }
            const { HEAPU8, view } = getMemory(this);
            const wasi = _wasi.get(this);
            const fileDescriptor = wasi.fds.get(fd, WasiRights.FD_WRITE, BigInt(0));
            if (!iovslen) {
                view.setUint32(size, 0, true);
                return 0 /* WasiErrno.ESUCCESS */;
            }
            const buffer = concatBuffer(Array.from({ length: Number(iovslen) }, (_, i) => {
                const offset = iovs + (i * 8);
                const buf = view.getInt32(offset, true);
                const bufLen = view.getUint32(offset + 4, true);
                return HEAPU8.subarray(buf, buf + bufLen);
            }));
            let nwritten;
            if (fd === 1 || fd === 2) {
                nwritten = fileDescriptor.write(buffer);
            }
            else {
                nwritten = await (await (fileDescriptor.fd.write(buffer, 0, buffer.length, Number(fileDescriptor.pos)))).bytesWritten;
                fileDescriptor.pos += BigInt(nwritten);
            }
            view.setUint32(size, nwritten, true);
            return 0 /* WasiErrno.ESUCCESS */;
        }, ['i32', 'i32', 'i32', 'i32'], ['i32']);
        defineImport('path_create_directory', function path_create_directory(fd, path, path_len) {
            path = Number(path);
            path_len = Number(path_len);
            if (path === 0) {
                return 28 /* WasiErrno.EINVAL */;
            }
            const { HEAPU8 } = getMemory(this);
            const wasi = _wasi.get(this);
            const fileDescriptor = wasi.fds.get(fd, WasiRights.PATH_CREATE_DIRECTORY, BigInt(0));
            let pathString = decoder.decode(unsharedSlice(HEAPU8, path, path + path_len));
            pathString = resolve(fileDescriptor.realPath, pathString);
            const fs = getFs(this);
            fs.mkdirSync(pathString);
            return 0 /* WasiErrno.ESUCCESS */;
        }, async function path_create_directory(fd, path, path_len) {
            path = Number(path);
            path_len = Number(path_len);
            if (path === 0) {
                return 28 /* WasiErrno.EINVAL */;
            }
            const { HEAPU8 } = getMemory(this);
            const wasi = _wasi.get(this);
            const fileDescriptor = wasi.fds.get(fd, WasiRights.PATH_CREATE_DIRECTORY, BigInt(0));
            let pathString = decoder.decode(unsharedSlice(HEAPU8, path, path + path_len));
            pathString = resolve(fileDescriptor.realPath, pathString);
            const fs = getFs(this);
            await fs.promises.mkdir(pathString);
            return 0 /* WasiErrno.ESUCCESS */;
        }, ['i32', 'i32', 'i32'], ['i32']);
        defineImport('path_filestat_get', function path_filestat_get(fd, flags, path, path_len, filestat) {
            path = Number(path);
            path_len = Number(path_len);
            filestat = Number(filestat);
            if (path === 0 || filestat === 0) {
                return 28 /* WasiErrno.EINVAL */;
            }
            const { HEAPU8, view } = getMemory(this);
            const wasi = _wasi.get(this);
            const fileDescriptor = wasi.fds.get(fd, WasiRights.PATH_FILESTAT_GET, BigInt(0));
            let pathString = decoder.decode(unsharedSlice(HEAPU8, path, path + path_len));
            const fs = getFs(this);
            pathString = resolve(fileDescriptor.realPath, pathString);
            let stat;
            if ((flags & 1) === 1) {
                stat = fs.statSync(pathString, { bigint: true });
            }
            else {
                stat = fs.lstatSync(pathString, { bigint: true });
            }
            toFileStat(view, filestat, stat);
            return 0 /* WasiErrno.ESUCCESS */;
        }, async function path_filestat_get(fd, flags, path, path_len, filestat) {
            path = Number(path);
            path_len = Number(path_len);
            filestat = Number(filestat);
            if (path === 0 || filestat === 0) {
                return 28 /* WasiErrno.EINVAL */;
            }
            const { HEAPU8, view } = getMemory(this);
            const wasi = _wasi.get(this);
            const fileDescriptor = wasi.fds.get(fd, WasiRights.PATH_FILESTAT_GET, BigInt(0));
            let pathString = decoder.decode(unsharedSlice(HEAPU8, path, path + path_len));
            const fs = getFs(this);
            pathString = resolve(fileDescriptor.realPath, pathString);
            let stat;
            if ((flags & 1) === 1) {
                stat = await fs.promises.stat(pathString, { bigint: true });
            }
            else {
                stat = await fs.promises.lstat(pathString, { bigint: true });
            }
            toFileStat(view, filestat, stat);
            return 0 /* WasiErrno.ESUCCESS */;
        }, ['i32', 'i32', 'i32', 'i32', 'i32'], ['i32']);
        defineImport('path_filestat_set_times', function path_filestat_set_times(fd, flags, path, path_len, atim, mtim, fst_flags) {
            path = Number(path);
            path_len = Number(path_len);
            if (path === 0)
                return 28 /* WasiErrno.EINVAL */;
            const { HEAPU8 } = getMemory(this);
            const wasi = _wasi.get(this);
            const fileDescriptor = wasi.fds.get(fd, WasiRights.PATH_FILESTAT_SET_TIMES, BigInt(0));
            if (validateFstFlagsOrReturn(fst_flags)) {
                return 28 /* WasiErrno.EINVAL */;
            }
            const fs = getFs(this);
            const resolvedPath = resolvePathSync(fs, fileDescriptor, decoder.decode(unsharedSlice(HEAPU8, path, path + path_len)), flags);
            if ((fst_flags & 2 /* WasiFstFlag.SET_ATIM_NOW */) === 2 /* WasiFstFlag.SET_ATIM_NOW */) {
                atim = BigInt(Date.now() * 1000000);
            }
            if ((fst_flags & 8 /* WasiFstFlag.SET_MTIM_NOW */) === 8 /* WasiFstFlag.SET_MTIM_NOW */) {
                mtim = BigInt(Date.now() * 1000000);
            }
            fs.utimesSync(resolvedPath, Number(atim), Number(mtim));
            return 0 /* WasiErrno.ESUCCESS */;
        }, async function path_filestat_set_times(fd, flags, path, path_len, atim, mtim, fst_flags) {
            path = Number(path);
            path_len = Number(path_len);
            if (path === 0)
                return 28 /* WasiErrno.EINVAL */;
            const { HEAPU8 } = getMemory(this);
            const wasi = _wasi.get(this);
            const fileDescriptor = wasi.fds.get(fd, WasiRights.PATH_FILESTAT_SET_TIMES, BigInt(0));
            if (validateFstFlagsOrReturn(fst_flags)) {
                return 28 /* WasiErrno.EINVAL */;
            }
            const fs = getFs(this);
            const resolvedPath = await resolvePathAsync(fs, fileDescriptor, decoder.decode(unsharedSlice(HEAPU8, path, path + path_len)), flags);
            if ((fst_flags & 2 /* WasiFstFlag.SET_ATIM_NOW */) === 2 /* WasiFstFlag.SET_ATIM_NOW */) {
                atim = BigInt(Date.now() * 1000000);
            }
            if ((fst_flags & 8 /* WasiFstFlag.SET_MTIM_NOW */) === 8 /* WasiFstFlag.SET_MTIM_NOW */) {
                mtim = BigInt(Date.now() * 1000000);
            }
            await fs.promises.utimes(resolvedPath, Number(atim), Number(mtim));
            return 0 /* WasiErrno.ESUCCESS */;
        }, ['i32', 'i32', 'i32', 'i32', 'i64', 'i64', 'i32'], ['i32']);
        defineImport('path_link', function path_link(old_fd, old_flags, old_path, old_path_len, new_fd, new_path, new_path_len) {
            old_path = Number(old_path);
            old_path_len = Number(old_path_len);
            new_path = Number(new_path);
            new_path_len = Number(new_path_len);
            if (old_path === 0 || new_path === 0) {
                return 28 /* WasiErrno.EINVAL */;
            }
            const wasi = _wasi.get(this);
            let oldWrap;
            let newWrap;
            if (old_fd === new_fd) {
                oldWrap = newWrap = wasi.fds.get(old_fd, WasiRights.PATH_LINK_SOURCE | WasiRights.PATH_LINK_TARGET, BigInt(0));
            }
            else {
                oldWrap = wasi.fds.get(old_fd, WasiRights.PATH_LINK_SOURCE, BigInt(0));
                newWrap = wasi.fds.get(new_fd, WasiRights.PATH_LINK_TARGET, BigInt(0));
            }
            const { HEAPU8 } = getMemory(this);
            const fs = getFs(this);
            const resolvedOldPath = resolvePathSync(fs, oldWrap, decoder.decode(unsharedSlice(HEAPU8, old_path, old_path + old_path_len)), old_flags);
            const resolvedNewPath = resolve(newWrap.realPath, decoder.decode(unsharedSlice(HEAPU8, new_path, new_path + new_path_len)));
            fs.linkSync(resolvedOldPath, resolvedNewPath);
            return 0 /* WasiErrno.ESUCCESS */;
        }, async function path_link(old_fd, old_flags, old_path, old_path_len, new_fd, new_path, new_path_len) {
            old_path = Number(old_path);
            old_path_len = Number(old_path_len);
            new_path = Number(new_path);
            new_path_len = Number(new_path_len);
            if (old_path === 0 || new_path === 0) {
                return 28 /* WasiErrno.EINVAL */;
            }
            const wasi = _wasi.get(this);
            let oldWrap;
            let newWrap;
            if (old_fd === new_fd) {
                oldWrap = newWrap = wasi.fds.get(old_fd, WasiRights.PATH_LINK_SOURCE | WasiRights.PATH_LINK_TARGET, BigInt(0));
            }
            else {
                oldWrap = wasi.fds.get(old_fd, WasiRights.PATH_LINK_SOURCE, BigInt(0));
                newWrap = wasi.fds.get(new_fd, WasiRights.PATH_LINK_TARGET, BigInt(0));
            }
            const { HEAPU8 } = getMemory(this);
            const fs = getFs(this);
            const resolvedOldPath = await resolvePathAsync(fs, oldWrap, decoder.decode(unsharedSlice(HEAPU8, old_path, old_path + old_path_len)), old_flags);
            const resolvedNewPath = resolve(newWrap.realPath, decoder.decode(unsharedSlice(HEAPU8, new_path, new_path + new_path_len)));
            await fs.promises.link(resolvedOldPath, resolvedNewPath);
            return 0 /* WasiErrno.ESUCCESS */;
        }, ['i32', 'i32', 'i32', 'i32', 'i32', 'i32', 'i32'], ['i32']);
        function pathOpen(o_flags, fs_rights_base, fs_rights_inheriting, fs_flags) {
            const read = (fs_rights_base & (WasiRights.FD_READ |
                WasiRights.FD_READDIR)) !== BigInt(0);
            const write = (fs_rights_base & (WasiRights.FD_DATASYNC |
                WasiRights.FD_WRITE |
                WasiRights.FD_ALLOCATE |
                WasiRights.FD_FILESTAT_SET_SIZE)) !== BigInt(0);
            let flags = write ? read ? 2 /* FileControlFlag.O_RDWR */ : 1 /* FileControlFlag.O_WRONLY */ : 0 /* FileControlFlag.O_RDONLY */;
            let needed_base = WasiRights.PATH_OPEN;
            let needed_inheriting = fs_rights_base | fs_rights_inheriting;
            if ((o_flags & 1 /* WasiFileControlFlag.O_CREAT */) !== 0) {
                flags |= 64 /* FileControlFlag.O_CREAT */;
                needed_base |= WasiRights.PATH_CREATE_FILE;
            }
            if ((o_flags & 2 /* WasiFileControlFlag.O_DIRECTORY */) !== 0) {
                flags |= 65536 /* FileControlFlag.O_DIRECTORY */;
            }
            if ((o_flags & 4 /* WasiFileControlFlag.O_EXCL */) !== 0) {
                flags |= 128 /* FileControlFlag.O_EXCL */;
            }
            if ((o_flags & 8 /* WasiFileControlFlag.O_TRUNC */) !== 0) {
                flags |= 512 /* FileControlFlag.O_TRUNC */;
                needed_base |= WasiRights.PATH_FILESTAT_SET_SIZE;
            }
            if ((fs_flags & 1 /* WasiFdFlag.APPEND */) !== 0) {
                flags |= 1024 /* FileControlFlag.O_APPEND */;
            }
            if ((fs_flags & 2 /* WasiFdFlag.DSYNC */) !== 0) {
                // flags |= FileControlFlag.O_DSYNC;
                needed_inheriting |= WasiRights.FD_DATASYNC;
            }
            if ((fs_flags & 4 /* WasiFdFlag.NONBLOCK */) !== 0) {
                flags |= 2048 /* FileControlFlag.O_NONBLOCK */;
            }
            if ((fs_flags & 8 /* WasiFdFlag.RSYNC */) !== 0) {
                flags |= 1052672 /* FileControlFlag.O_SYNC */;
                needed_inheriting |= WasiRights.FD_SYNC;
            }
            if ((fs_flags & 16 /* WasiFdFlag.SYNC */) !== 0) {
                flags |= 1052672 /* FileControlFlag.O_SYNC */;
                needed_inheriting |= WasiRights.FD_SYNC;
            }
            if (write && (flags & (1024 /* FileControlFlag.O_APPEND */ | 512 /* FileControlFlag.O_TRUNC */)) === 0) {
                needed_inheriting |= WasiRights.FD_SEEK;
            }
            return { flags, needed_base, needed_inheriting };
        }
        defineImport('path_open', function path_open(dirfd, dirflags, path, path_len, o_flags, fs_rights_base, fs_rights_inheriting, fs_flags, fd) {
            path = Number(path);
            fd = Number(fd);
            if (path === 0 || fd === 0) {
                return 28 /* WasiErrno.EINVAL */;
            }
            path_len = Number(path_len);
            fs_rights_base = BigInt(fs_rights_base);
            fs_rights_inheriting = BigInt(fs_rights_inheriting);
            const { flags: flagsRes, needed_base: neededBase, needed_inheriting: neededInheriting } = pathOpen(o_flags, fs_rights_base, fs_rights_inheriting, fs_flags);
            const wasi = _wasi.get(this);
            const fileDescriptor = wasi.fds.get(dirfd, neededBase, neededInheriting);
            const memory = getMemory(this);
            const HEAPU8 = memory.HEAPU8;
            const pathString = decoder.decode(unsharedSlice(HEAPU8, path, path + path_len));
            const fs = getFs(this);
            const resolved_path = resolvePathSync(fs, fileDescriptor, pathString, dirflags);
            const r = fs.openSync(resolved_path, flagsRes, 0o666);
            const filetype = wasi.fds.getFileTypeByFd(r);
            if ((o_flags & 2 /* WasiFileControlFlag.O_DIRECTORY */) !== 0 && filetype !== 3 /* WasiFileType.DIRECTORY */) {
                return 54 /* WasiErrno.ENOTDIR */;
            }
            const { base: max_base, inheriting: max_inheriting } = getRights(wasi.fds.stdio, r, flagsRes, filetype);
            const wrap = wasi.fds.insert(r, resolved_path, resolved_path, filetype, fs_rights_base & max_base, fs_rights_inheriting & max_inheriting, 0);
            const stat = fs.fstatSync(r, { bigint: true });
            if (stat.isFile()) {
                wrap.size = stat.size;
                if ((flagsRes & 1024 /* FileControlFlag.O_APPEND */) !== 0) {
                    wrap.pos = stat.size;
                }
            }
            const view = memory.view;
            view.setInt32(fd, wrap.id, true);
            return 0 /* WasiErrno.ESUCCESS */;
        }, async function path_open(dirfd, dirflags, path, path_len, o_flags, fs_rights_base, fs_rights_inheriting, fs_flags, fd) {
            path = Number(path);
            fd = Number(fd);
            if (path === 0 || fd === 0) {
                return 28 /* WasiErrno.EINVAL */;
            }
            path_len = Number(path_len);
            fs_rights_base = BigInt(fs_rights_base);
            fs_rights_inheriting = BigInt(fs_rights_inheriting);
            const { flags: flagsRes, needed_base: neededBase, needed_inheriting: neededInheriting } = pathOpen(o_flags, fs_rights_base, fs_rights_inheriting, fs_flags);
            const wasi = _wasi.get(this);
            const fileDescriptor = wasi.fds.get(dirfd, neededBase, neededInheriting);
            const memory = getMemory(this);
            const HEAPU8 = memory.HEAPU8;
            const pathString = decoder.decode(unsharedSlice(HEAPU8, path, path + path_len));
            const fs = getFs(this);
            const resolved_path = await resolvePathAsync(fs, fileDescriptor, pathString, dirflags);
            const r = await fs.promises.open(resolved_path, flagsRes, 0o666);
            const filetype = await wasi.fds.getFileTypeByFd(r);
            if ((o_flags & 2 /* WasiFileControlFlag.O_DIRECTORY */) !== 0 && filetype !== 3 /* WasiFileType.DIRECTORY */) {
                return 54 /* WasiErrno.ENOTDIR */;
            }
            const { base: max_base, inheriting: max_inheriting } = getRights(wasi.fds.stdio, r.fd, flagsRes, filetype);
            const wrap = wasi.fds.insert(r, resolved_path, resolved_path, filetype, fs_rights_base & max_base, fs_rights_inheriting & max_inheriting, 0);
            const stat = await r.stat({ bigint: true });
            if (stat.isFile()) {
                wrap.size = stat.size;
                if ((flagsRes & 1024 /* FileControlFlag.O_APPEND */) !== 0) {
                    wrap.pos = stat.size;
                }
            }
            const view = memory.view;
            view.setInt32(fd, wrap.id, true);
            return 0 /* WasiErrno.ESUCCESS */;
        }, ['i32', 'i32', 'i32', 'i32', 'i32', 'i64', 'i64', 'i32', 'i32'], ['i32']);
        defineImport('path_readlink', function path_readlink(fd, path, path_len, buf, buf_len, bufused) {
            path = Number(path);
            path_len = Number(path_len);
            buf = Number(buf);
            buf_len = Number(buf_len);
            bufused = Number(bufused);
            if (path === 0 || buf === 0 || bufused === 0) {
                return 28 /* WasiErrno.EINVAL */;
            }
            const { HEAPU8, view } = getMemory(this);
            const wasi = _wasi.get(this);
            const fileDescriptor = wasi.fds.get(fd, WasiRights.PATH_READLINK, BigInt(0));
            let pathString = decoder.decode(unsharedSlice(HEAPU8, path, path + path_len));
            pathString = resolve(fileDescriptor.realPath, pathString);
            const fs = getFs(this);
            const link = fs.readlinkSync(pathString);
            const linkData = encoder.encode(link);
            const len = Math.min(linkData.length, buf_len);
            if (len >= buf_len)
                return 42 /* WasiErrno.ENOBUFS */;
            HEAPU8.set(linkData.subarray(0, len), buf);
            HEAPU8[buf + len] = 0;
            view.setUint32(bufused, len, true);
            return 0 /* WasiErrno.ESUCCESS */;
        }, async function path_readlink(fd, path, path_len, buf, buf_len, bufused) {
            path = Number(path);
            path_len = Number(path_len);
            buf = Number(buf);
            buf_len = Number(buf_len);
            bufused = Number(bufused);
            if (path === 0 || buf === 0 || bufused === 0) {
                return 28 /* WasiErrno.EINVAL */;
            }
            const { HEAPU8, view } = getMemory(this);
            const wasi = _wasi.get(this);
            const fileDescriptor = wasi.fds.get(fd, WasiRights.PATH_READLINK, BigInt(0));
            let pathString = decoder.decode(unsharedSlice(HEAPU8, path, path + path_len));
            pathString = resolve(fileDescriptor.realPath, pathString);
            const fs = getFs(this);
            const link = await fs.promises.readlink(pathString);
            const linkData = encoder.encode(link);
            const len = Math.min(linkData.length, buf_len);
            if (len >= buf_len)
                return 42 /* WasiErrno.ENOBUFS */;
            HEAPU8.set(linkData.subarray(0, len), buf);
            HEAPU8[buf + len] = 0;
            view.setUint32(bufused, len, true);
            return 0 /* WasiErrno.ESUCCESS */;
        }, ['i32', 'i32', 'i32', 'i32', 'i32', 'i32'], ['i32']);
        defineImport('path_remove_directory', function path_remove_directory(fd, path, path_len) {
            path = Number(path);
            path_len = Number(path_len);
            if (path === 0) {
                return 28 /* WasiErrno.EINVAL */;
            }
            const { HEAPU8 } = getMemory(this);
            const wasi = _wasi.get(this);
            const fileDescriptor = wasi.fds.get(fd, WasiRights.PATH_REMOVE_DIRECTORY, BigInt(0));
            let pathString = decoder.decode(unsharedSlice(HEAPU8, path, path + path_len));
            pathString = resolve(fileDescriptor.realPath, pathString);
            const fs = getFs(this);
            fs.rmdirSync(pathString);
            return 0 /* WasiErrno.ESUCCESS */;
        }, async function path_remove_directory(fd, path, path_len) {
            path = Number(path);
            path_len = Number(path_len);
            if (path === 0) {
                return 28 /* WasiErrno.EINVAL */;
            }
            const { HEAPU8 } = getMemory(this);
            const wasi = _wasi.get(this);
            const fileDescriptor = wasi.fds.get(fd, WasiRights.PATH_REMOVE_DIRECTORY, BigInt(0));
            let pathString = decoder.decode(unsharedSlice(HEAPU8, path, path + path_len));
            pathString = resolve(fileDescriptor.realPath, pathString);
            const fs = getFs(this);
            await fs.promises.rmdir(pathString);
            return 0 /* WasiErrno.ESUCCESS */;
        }, ['i32', 'i32', 'i32'], ['i32']);
        defineImport('path_rename', function path_rename(old_fd, old_path, old_path_len, new_fd, new_path, new_path_len) {
            old_path = Number(old_path);
            old_path_len = Number(old_path_len);
            new_path = Number(new_path);
            new_path_len = Number(new_path_len);
            if (old_path === 0 || new_path === 0) {
                return 28 /* WasiErrno.EINVAL */;
            }
            const wasi = _wasi.get(this);
            let oldWrap;
            let newWrap;
            if (old_fd === new_fd) {
                oldWrap = newWrap = wasi.fds.get(old_fd, WasiRights.PATH_RENAME_SOURCE | WasiRights.PATH_RENAME_TARGET, BigInt(0));
            }
            else {
                oldWrap = wasi.fds.get(old_fd, WasiRights.PATH_RENAME_SOURCE, BigInt(0));
                newWrap = wasi.fds.get(new_fd, WasiRights.PATH_RENAME_TARGET, BigInt(0));
            }
            const { HEAPU8 } = getMemory(this);
            const resolvedOldPath = resolve(oldWrap.realPath, decoder.decode(unsharedSlice(HEAPU8, old_path, old_path + old_path_len)));
            const resolvedNewPath = resolve(newWrap.realPath, decoder.decode(unsharedSlice(HEAPU8, new_path, new_path + new_path_len)));
            const fs = getFs(this);
            fs.renameSync(resolvedOldPath, resolvedNewPath);
            return 0 /* WasiErrno.ESUCCESS */;
        }, async function path_rename(old_fd, old_path, old_path_len, new_fd, new_path, new_path_len) {
            old_path = Number(old_path);
            old_path_len = Number(old_path_len);
            new_path = Number(new_path);
            new_path_len = Number(new_path_len);
            if (old_path === 0 || new_path === 0) {
                return 28 /* WasiErrno.EINVAL */;
            }
            const wasi = _wasi.get(this);
            let oldWrap;
            let newWrap;
            if (old_fd === new_fd) {
                oldWrap = newWrap = wasi.fds.get(old_fd, WasiRights.PATH_RENAME_SOURCE | WasiRights.PATH_RENAME_TARGET, BigInt(0));
            }
            else {
                oldWrap = wasi.fds.get(old_fd, WasiRights.PATH_RENAME_SOURCE, BigInt(0));
                newWrap = wasi.fds.get(new_fd, WasiRights.PATH_RENAME_TARGET, BigInt(0));
            }
            const { HEAPU8 } = getMemory(this);
            const resolvedOldPath = resolve(oldWrap.realPath, decoder.decode(unsharedSlice(HEAPU8, old_path, old_path + old_path_len)));
            const resolvedNewPath = resolve(newWrap.realPath, decoder.decode(unsharedSlice(HEAPU8, new_path, new_path + new_path_len)));
            const fs = getFs(this);
            await fs.promises.rename(resolvedOldPath, resolvedNewPath);
            return 0 /* WasiErrno.ESUCCESS */;
        }, ['i32', 'i32', 'i32', 'i32', 'i32', 'i32'], ['i32']);
        defineImport('path_symlink', function path_symlink(old_path, old_path_len, fd, new_path, new_path_len) {
            old_path = Number(old_path);
            old_path_len = Number(old_path_len);
            new_path = Number(new_path);
            new_path_len = Number(new_path_len);
            if (old_path === 0 || new_path === 0) {
                return 28 /* WasiErrno.EINVAL */;
            }
            const { HEAPU8 } = getMemory(this);
            const wasi = _wasi.get(this);
            const fileDescriptor = wasi.fds.get(fd, WasiRights.PATH_SYMLINK, BigInt(0));
            const oldPath = decoder.decode(unsharedSlice(HEAPU8, old_path, old_path + old_path_len));
            let newPath = decoder.decode(unsharedSlice(HEAPU8, new_path, new_path + new_path_len));
            newPath = resolve(fileDescriptor.realPath, newPath);
            const fs = getFs(this);
            fs.symlinkSync(oldPath, newPath);
            return 0 /* WasiErrno.ESUCCESS */;
        }, async function path_symlink(old_path, old_path_len, fd, new_path, new_path_len) {
            old_path = Number(old_path);
            old_path_len = Number(old_path_len);
            new_path = Number(new_path);
            new_path_len = Number(new_path_len);
            if (old_path === 0 || new_path === 0) {
                return 28 /* WasiErrno.EINVAL */;
            }
            const { HEAPU8 } = getMemory(this);
            const wasi = _wasi.get(this);
            const fileDescriptor = wasi.fds.get(fd, WasiRights.PATH_SYMLINK, BigInt(0));
            const oldPath = decoder.decode(unsharedSlice(HEAPU8, old_path, old_path + old_path_len));
            let newPath = decoder.decode(unsharedSlice(HEAPU8, new_path, new_path + new_path_len));
            newPath = resolve(fileDescriptor.realPath, newPath);
            const fs = getFs(this);
            await fs.promises.symlink(oldPath, newPath);
            return 0 /* WasiErrno.ESUCCESS */;
        }, ['i32', 'i32', 'i32', 'i32', 'i32'], ['i32']);
        defineImport('path_unlink_file', function path_unlink_file(fd, path, path_len) {
            path = Number(path);
            path_len = Number(path_len);
            if (path === 0) {
                return 28 /* WasiErrno.EINVAL */;
            }
            const { HEAPU8 } = getMemory(this);
            const wasi = _wasi.get(this);
            const fileDescriptor = wasi.fds.get(fd, WasiRights.PATH_UNLINK_FILE, BigInt(0));
            let pathString = decoder.decode(unsharedSlice(HEAPU8, path, path + path_len));
            pathString = resolve(fileDescriptor.realPath, pathString);
            const fs = getFs(this);
            fs.unlinkSync(pathString);
            return 0 /* WasiErrno.ESUCCESS */;
        }, async function path_unlink_file(fd, path, path_len) {
            path = Number(path);
            path_len = Number(path_len);
            if (path === 0) {
                return 28 /* WasiErrno.EINVAL */;
            }
            const { HEAPU8 } = getMemory(this);
            const wasi = _wasi.get(this);
            const fileDescriptor = wasi.fds.get(fd, WasiRights.PATH_UNLINK_FILE, BigInt(0));
            let pathString = decoder.decode(unsharedSlice(HEAPU8, path, path + path_len));
            pathString = resolve(fileDescriptor.realPath, pathString);
            const fs = getFs(this);
            await fs.promises.unlink(pathString);
            return 0 /* WasiErrno.ESUCCESS */;
        }, ['i32', 'i32', 'i32'], ['i32']);
        this._setMemory = function setMemory(m) {
            if (!(m instanceof _WebAssembly.Memory)) {
                throw new TypeError('"instance.exports.memory" property must be a WebAssembly.Memory');
            }
            _memory.set(_this, extendMemory(m));
        };
    }
    static createSync(args, env, preopens, stdio, fs, print, printErr) {
        const fds = new SyncTable({
            size: 3,
            in: stdio[0],
            out: stdio[1],
            err: stdio[2],
            fs,
            print,
            printErr
        });
        const _this = new WASI$1(args, env, fds, false, fs);
        if (preopens.length > 0) {
            for (let i = 0; i < preopens.length; ++i) {
                const realPath = fs.realpathSync(preopens[i].realPath, 'utf8');
                const fd = fs.openSync(realPath, 'r', 0o666);
                fds.insertPreopen(fd, preopens[i].mappedPath, realPath);
            }
        }
        return _this;
    }
    static async createAsync(args, env, preopens, stdio, fs, print, printErr, asyncify) {
        const fds = new AsyncTable({
            size: 3,
            in: stdio[0],
            out: stdio[1],
            err: stdio[2],
            print,
            printErr
        });
        const _this = new WASI$1(args, env, fds, true, fs, asyncify);
        if (preopens.length > 0) {
            for (let i = 0; i < preopens.length; ++i) {
                const entry = preopens[i];
                const realPath = await fs.promises.realpath(entry.realPath);
                const fd = await fs.promises.open(realPath, 'r', 0o666);
                await fds.insertPreopen(fd, entry.mappedPath, realPath);
            }
        }
        return _this;
    }
}

// eslint-disable-next-line spaced-comment
const kEmptyObject = /*#__PURE__*/ Object.freeze(/*#__PURE__*/ Object.create(null));
const kExitCode = Symbol('kExitCode');
const kSetMemory = Symbol('kSetMemory');
const kStarted = Symbol('kStarted');
const kInstance = Symbol('kInstance');
const kBindingName = Symbol('kBindingName');
function setupInstance(self, instance) {
    validateObject(instance, 'instance');
    validateObject(instance.exports, 'instance.exports');
    self[kInstance] = instance;
    self[kSetMemory](instance.exports.memory);
}
function validateOptions(options) {
    var _a;
    validateObject(options, 'options');
    let _WASI;
    if (options.version !== undefined) {
        validateString(options.version, 'options.version');
        switch (options.version) {
            case 'unstable':
                _WASI = WASI$1;
                this[kBindingName] = 'wasi_unstable';
                break;
            case 'preview1':
                _WASI = WASI$1;
                this[kBindingName] = 'wasi_snapshot_preview1';
                break;
            default:
                throw new TypeError(`unsupported WASI version "${options.version}"`);
        }
    }
    else {
        _WASI = WASI$1;
        this[kBindingName] = 'wasi_snapshot_preview1';
    }
    if (options.args !== undefined) {
        validateArray(options.args, 'options.args');
    }
    const args = ((_a = options.args) !== null && _a !== void 0 ? _a : []).map(String);
    const env = [];
    if (options.env !== undefined) {
        validateObject(options.env, 'options.env');
        Object.entries(options.env).forEach(({ 0: key, 1: value }) => {
            if (value !== undefined) {
                env.push(`${key}=${value}`);
            }
        });
    }
    const preopens = [];
    if (options.preopens !== undefined) {
        validateObject(options.preopens, 'options.preopens');
        Object.entries(options.preopens).forEach(({ 0: key, 1: value }) => preopens.push({ mappedPath: String(key), realPath: String(value) }));
    }
    if (preopens.length > 0) {
        if (options.fs === undefined) {
            throw new Error('filesystem is disabled, can not preopen directory');
        }
        try {
            validateObject(options.fs, 'options.fs');
        }
        catch (_) {
            throw new TypeError('Node.js fs like implementation is not provided');
        }
    }
    // if (options.filesystem !== undefined) {
    //   validateObject(options.filesystem, 'options.filesystem')
    //   validateString(options.filesystem.type, 'options.filesystem.type')
    //   if (options.filesystem.type !== 'memfs' && options.filesystem.type !== 'file-system-access-api') {
    //     throw new Error(`Filesystem type ${(options.filesystem as any).type as string} is not supported, only "memfs" and "file-system-access-api" is supported currently`)
    //   }
    //   try {
    //     validateObject(options.filesystem.fs, 'options.filesystem.fs')
    //   } catch (_) {
    //     throw new Error('Node.js fs like implementation is not provided')
    //   }
    // }
    if (options.print !== undefined)
        validateFunction(options.print, 'options.print');
    if (options.printErr !== undefined)
        validateFunction(options.printErr, 'options.printErr');
    if (options.returnOnExit !== undefined) {
        validateBoolean(options.returnOnExit, 'options.returnOnExit');
    }
    // const { stdin = 0, stdout = 1, stderr = 2 } = options
    // validateInt32(stdin, 'options.stdin', 0)
    // validateInt32(stdout, 'options.stdout', 0)
    // validateInt32(stderr, 'options.stderr', 0)
    // const stdio = [stdin, stdout, stderr] as const
    const stdio = [0, 1, 2];
    return {
        args,
        env,
        preopens,
        stdio,
        _WASI
    };
}
function initWASI(setMemory, wrap) {
    this[kSetMemory] = setMemory;
    this.wasiImport = wrap;
    this[kStarted] = false;
    this[kExitCode] = 0;
    this[kInstance] = undefined;
}
/** @public */
class WASI {
    constructor(options = kEmptyObject) {
        const { args, env, preopens, stdio, _WASI } = validateOptions.call(this, options);
        const wrap = _WASI.createSync(args, env, preopens, stdio, options.fs, options.print, options.printErr);
        const setMemory = wrap._setMemory;
        delete wrap._setMemory;
        initWASI.call(this, setMemory, wrap);
        if (options.returnOnExit) {
            wrap.proc_exit = wasiReturnOnProcExit.bind(this);
        }
    }
    // Must not export _initialize, must export _start
    start(instance) {
        if (this[kStarted]) {
            throw new Error('WASI instance has already started');
        }
        this[kStarted] = true;
        setupInstance(this, instance);
        const { _start, _initialize } = this[kInstance].exports;
        validateFunction(_start, 'instance.exports._start');
        validateUndefined(_initialize, 'instance.exports._initialize');
        let ret;
        try {
            ret = _start();
        }
        catch (err) {
            if (err !== kExitCode) {
                throw err;
            }
        }
        if (ret instanceof Promise) {
            return ret.then(() => this[kExitCode], (err) => {
                if (err !== kExitCode) {
                    throw err;
                }
                return this[kExitCode];
            });
        }
        return this[kExitCode];
    }
    // Must not export _start, may optionally export _initialize
    initialize(instance) {
        if (this[kStarted]) {
            throw new Error('WASI instance has already started');
        }
        this[kStarted] = true;
        setupInstance(this, instance);
        const { _start, _initialize } = this[kInstance].exports;
        validateUndefined(_start, 'instance.exports._start');
        if (_initialize !== undefined) {
            validateFunction(_initialize, 'instance.exports._initialize');
            return _initialize();
        }
    }
    getImportObject() {
        return { [this[kBindingName]]: this.wasiImport };
    }
}
function wasiReturnOnProcExit(rval) {
    this[kExitCode] = rval;
    // eslint-disable-next-line @typescript-eslint/no-throw-literal
    throw kExitCode;
}

// @ts-check

/**
 * @param {unknown} value
 */
const getType = (value) => {
  if (value === undefined) return 0
  if (value === null) return 1
  const t = typeof value;
  if (t === 'boolean') return 2
  if (t === 'number') return 3
  if (t === 'string') return 4
  if (t === 'object') return 6
  if (t === 'bigint') return 9
  return -1
};

/**
 * @param {import('memfs').IFs} memfs
 * @param {any} value
 * @param {ReturnType<typeof getType>} type
 * @returns {Uint8Array}
 */
const encodeValue = (memfs, value, type) => {
  switch (type) {
    case 0:
    case 1:
      return new Uint8Array(0)
    case 2: {
      const view = new Int32Array(1);
      view[0] = value ? 1 : 0;
      return new Uint8Array(view.buffer)
    }
    case 3: {
      const view = new Float64Array(1);
      view[0] = value;
      return new Uint8Array(view.buffer)
    }
    case 4: {
      const view = new TextEncoder().encode(value);
      return view
    }
    case 6: {
      const [entry] = Object.entries(memfs).filter(([_, v]) => v === value.constructor)[0] ?? [];
      if (entry) {
        Object.defineProperty(value, '__constructor__', {
          configurable: true,
          writable: true,
          enumerable: true,
          value: entry
        });
      }

      const json = JSON.stringify(value, (_, value) => {
        if (typeof value === 'bigint') {
          return `BigInt(${String(value)})`
        }
        return value
      });
      const view = new TextEncoder().encode(json);
      return view
    }
    case 9: {
      const view = new BigInt64Array(1);
      view[0] = value;
      return new Uint8Array(view.buffer)
    }
    case -1:
    default:
      throw new Error('unsupported data')
  }
};

/**
 * @param {import('memfs').IFs} fs
 * @returns {(e: { data: { __fs__: { sab: Int32Array, type: keyof import('memfs').IFs, payload: any[] } } }) => void}
 */
var createOnMessage = (fs) => function onMessage(e) {
  if (e.data.__fs__) {
    /**
     * 0..4                    status(int32_t):        21(waiting) 0(success) 1(error)
     * 5..8                    type(napi_valuetype):   0(undefined) 1(null) 2(boolean) 3(number) 4(string) 6(jsonstring) 9(bigint) -1(unsupported)
     * 9..16                   payload_size(uint32_t)  <= 1024
     * 16..16 + payload_size   payload_content
     */
    const { sab, type, payload } = e.data.__fs__;
    const fn = fs[type];
    const args = payload ? payload.map((value) => {
      if (value instanceof Uint8Array) {
        // buffer polyfill bug
        // @ts-expect-error
        value._isBuffer = true;
      }
      return value
    }) : payload;
    try {
      const ret = fn.apply(fs, args);
      const t = getType(ret);
      const v = encodeValue(fs, ret, t);
      Atomics.store(sab, 0, 0);
      Atomics.store(sab, 1, t);
      Atomics.store(sab, 2, v.length);
      new Uint8Array(sab.buffer).set(v, 16);

    } catch (/** @type {any} */ err) {
      Atomics.store(sab, 0, 1);
      Atomics.store(sab, 1, 6);
      const payloadContent = new TextEncoder().encode(JSON.stringify({
        ...err,
        message: err.message,
        stack: err.stack
      }));
      Atomics.store(sab, 2, payloadContent.length);
      new Uint8Array(sab.buffer).set(payloadContent, 16);
    } finally {
      Atomics.notify(sab, 0);
    }
  }
};

/**
 * @param {import('memfs').IFs} memfs
 */
var createFsProxy = (memfs) => new Proxy({}, {
  get (_target, p, _receiver) {
    /**
     * @param {any[]} args
     */
    return function (...args) {
      const sab = new SharedArrayBuffer(16 + 1024);
      const i32arr = new Int32Array(sab);
      Atomics.store(i32arr, 0, 21);

      // @ts-expect-error
      postMessage({
        __fs__: {
          sab: i32arr,
          type: p,
          payload: args
        }
      });

      Atomics.wait(i32arr, 0, 21);

      const status = Atomics.load(i32arr, 0);
      const type = Atomics.load(i32arr, 1);
      const size = Atomics.load(i32arr, 2);
      const content = new Uint8Array(sab, 16, size);
      if (status === 1) {
        const errobj = JSON.parse(new TextDecoder().decode(content.slice()));
        const err = new Error(errobj.message);
        Object.defineProperty(err, 'stack', {
          configurable: true,
          enumerable: false,
          writable: true,
          value: errobj.stack
        });
        for (const [k, v] of Object.entries(errobj)) {
          if (k === 'message' || k === 'stack') continue
          // @ts-expect-error
          err[k] = v;
        }
        throw err
      }
      if (type === 0) return undefined
      if (type === 1) return null
      if (type === 2) return Boolean(content[0])
      if (type === 3) return new Float64Array(sab, 16, 1)[0]
      if (type === 4) return new TextDecoder().decode(content.slice())
      if (type === 6) {
        const obj = JSON.parse(new TextDecoder().decode(content.slice()), (_key, value) => {
          if (typeof value === 'string') {
            const matched = value.match(/^BigInt\((-?\d+)\)$/);
            if (matched && matched[1]) {
              return BigInt(matched[1])
            }
          }
          return value
        });
        if (obj.__constructor__) {
          const ctor = obj.__constructor__;
          delete obj.__constructor__;
          // @ts-expect-error
          Object.setPrototypeOf(obj, memfs[ctor].prototype);
        }
        return obj
      }
      if (type === 9) return new BigInt64Array(sab, 16, 1)[0]
      throw new Error('unsupported data')
    }
  }
});

export { MessageHandler, WASI, createFsProxy, createOnMessage, getDefaultContext, instantiateNapiModule, instantiateNapiModuleSync };