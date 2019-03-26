import Vuex from "vuex";
//Plugin
const actionName = "__vcc_action";
export const VuexClassPlugin = (store) => {
    // 把 store 传入所有的实例中
    store.dispatch(actionName, store);
};
//创建Vuex.Store
export function createStore(strict, modules, plugins) {
    return new Vuex.Store(createOptions(strict, modules, plugins));
}
//创建VuexOptions
export function createOptions(strict, modules, plugins) {
    let opt = {};
    opt.strict = strict;
    if (modules.root) {
        opt.state = modules.root.state;
        opt.getters = modules.root.getters;
        opt.actions = modules.root.actions;
        opt.mutations = modules.root.mutations;
    }
    for (let name in modules) {
        if (name !== "root") {
            (opt.modules || (opt.modules = {}))[name] = modules[name];
        }
    }
    opt.plugins = [VuexClassPlugin];
    if (plugins && plugins.length > 0) {
        for (let i = 0, len = plugins.length; i < len; i++) {
            opt.plugins.push(plugins[i]);
        }
    }
    return opt;
}
//------------------------------------------------------------------------------------------------------------------------
// function donothing(target: any, key: string, desc?: PropertyDescriptor): any {
//   return desc;
// }
function marker(marker) {
    return function (target, key, desc) {
        (target[marker] || (target[marker] = {}))[key] = 1;
        return desc;
    };
}
function hasMarker(target, marker, key) {
    return target[marker] && target[marker][key];
}
// function exclude(target: any, key: string): boolean {
//   return (
//     hasMarker(target, excludeKey, key) ||
//     (target[constructorKey] !== key &&
//       !hasMarker(target, getterKey, key) &&
//       !hasMarker(target, mutationKey, key) &&
//       !hasMarker(target, actionKey, key))
//   );
// }
const excludeKey = "$_exclude_$";
const constructorKey = "$_constructor_$";
//const stateKey: string = "$_state_$";
const getterKey = "$_getter_$";
const mutationKey = "$_mutation_$";
const actionKey = "$_action_$";
export let Exclude = marker(excludeKey);
export let Constructor = function (target, key, desc) {
    target[constructorKey] = key;
    return desc;
};
//export let State = marker(stateKey);
export let Getter = marker(getterKey);
export let Mutation = marker(mutationKey);
export let Action = marker(actionKey);
//模块修饰器
export function VuexClass(options) {
    if (typeof options === "function") {
        return moduleFactory(options);
    }
    return function (construct) {
        return moduleFactory(construct, options);
    };
}
//动态的生成Vuex模块
function moduleFactory(construct, options = {}) {
    const base = construct.prototype;
    //新的基类
    const vm = {
        base,
        namespaced: options.name ? true : false,
        moduleName: options.name ? options.name : "",
        state: {},
        getters: {},
        mutations: {},
        actions: {},
        store: undefined,
        argCountCache: {}
    };
    //State
    let instance = new construct();
    //console.log(construct.toString());
    Object.keys(instance).forEach((key) => {
        //如果只是一个安静的美属性
        if (hasMarker(instance, excludeKey, key)) {
            vm[key] = instance[key];
            return;
        }
        //实例属性设置state
        const vuexKey = vm.namespaced ? vm.moduleName + "/" + key : key;
        const newDesc = {
        // configurable: desc.configurable,
        // enumerable: desc.enumerable
        };
        vm.state[key] = instance[key];
        //@Getter
        if (hasMarker(instance, getterKey, key)) {
            vm.getters[key] = (s, g, rs, rg) => {
                return s[key];
            };
            newDesc.get = () => {
                return vm.store
                    ? vm.store.getters[vuexKey]
                    : vm.state[key];
            };
        }
        else {
            newDesc.get = () => {
                //当Store初始化完成后，直接代理成对store.state的访问
                if (vm.store) {
                    let state = vm.store.state;
                    return vm.namespaced ? state[vm.moduleName][key] : state[key];
                }
                return vm.state[key];
            };
        }
        //@Mutation
        vm.mutations[key] = (state, payload) => {
            state[key] = payload;
        };
        newDesc.set = (payload) => {
            vm.store
                ? vm.store.commit(vuexKey, payload)
                : (vm.state[key] = payload);
        };
        Object.defineProperty(vm, key, newDesc);
    });
    instance = undefined;
    //获取类对象属性
    Object.getOwnPropertyNames(base).forEach(key => {
        if (key === "constructor" || (key.startsWith("$_") && key.endsWith("_$")))
            return;
        //@Exclude
        if (hasMarker(base, excludeKey, key)) {
            vm[key] = base[key];
            return;
        }
        //@Constructor
        if (base[constructorKey] === key) {
            vm[constructorKey] = base[key];
            return;
        }
        //
        const vuexKey = vm.namespaced ? vm.moduleName + "/" + key : key;
        let desc = Object.getOwnPropertyDescriptor(base, key);
        //console.log(key, descriptor);
        let newDesc = {
            configurable: desc.configurable,
            enumerable: desc.enumerable
        };
        //@Getter  get 实例方法
        if (typeof desc.get === "function") {
            vm.getters[key] = (s, g, rs, rg) => {
                return desc.get.apply(vm, [
                    {
                        state: s,
                        getters: g,
                        rootState: rs,
                        rootGetters: rg,
                        store: vm.store
                    }
                ]);
            };
            newDesc.get = () => {
                return vm.store
                    ? vm.store.getters[vuexKey]
                    : desc.get.apply(vm);
            };
        }
        //@Mutation set 实例方法
        if (typeof desc.set === "function") {
            vm.mutations[key] = (state, payload) => {
                desc.set.apply(vm, [
                    payload,
                    { state: state, store: vm.store }
                ]);
            };
            newDesc.set = (payload) => {
                vm.store
                    ? vm.store.commit(vuexKey, payload)
                    : desc.set.apply(vm, [payload]);
            };
        }
        //getter / mutation / action
        if (typeof desc.value === "function") {
            if (hasMarker(base, getterKey, key)) {
                //@Getters
                vm.getters[key] = (s, g, rs, rg) => {
                    return (...payloads) => {
                        return desc.value.apply(vm, getApplyArgs(vm, key, desc.value, [...payloads], {
                            state: s,
                            getters: g,
                            rootState: rs,
                            rootGetters: rg,
                            store: vm.store
                        }));
                    };
                };
                newDesc.get = () => {
                    return vm.store
                        ? vm.store.getters[vuexKey]
                        : desc.value.apply(vm, arguments);
                };
                //
                //@Mutations
            }
            else if (hasMarker(base, mutationKey, key)) {
                vm.mutations[key] = (state, payloads) => {
                    desc.value.apply(vm, getApplyArgs(vm, key, desc.value, [...payloads], {
                        state: state,
                        store: vm.store
                    }));
                };
                newDesc.get = () => {
                    return (...payloads) => {
                        vm.store
                            ? vm.store.commit(vuexKey, payloads)
                            : desc.value.apply(vm, payloads);
                    };
                };
            }
            else if (hasMarker(base, actionKey, key)) {
                //@Action 异步,返回一个Promise对象
                vm.actions[key] = (context, payloads) => {
                    return desc.value.apply(vm, getApplyArgs(vm, key, desc.value, [...payloads], {
                        context: context,
                        store: vm.store
                    }));
                };
                newDesc.value = (...payloads) => {
                    return vm.store
                        ? vm.store.dispatch(vuexKey, payloads)
                        : desc.value.apply(vm, payloads);
                };
            }
            else {
                vm[key] = base[key];
                newDesc = undefined;
            }
        }
        //
        if (newDesc)
            Object.defineProperty(vm, key, newDesc);
    });
    //接收一个全局action
    vm.actions[actionName] = {
        root: true,
        handler: (ctx, store) => {
            vm.store = store;
        }
    };
    //删除key
    delete base[excludeKey];
    delete base[constructorKey];
    //delete base[stateKey];
    delete base[getterKey];
    delete base[mutationKey];
    delete base[actionKey];
    construct.prototype = vm;
    //console.log(vm);
    //return  新的构造函数
    return function (...args) {
        let i = new construct();
        if (i[constructorKey])
            i[constructorKey](...args);
        return i;
    };
}
function getApplyArgs(vm, key, fn, s, vuexArg) {
    let argCount = 0;
    if (vm.argCountCache[key] == null) {
        argCount = getArgCount(fn);
        vm.argCountCache[key] = argCount;
    }
    else {
        argCount = vm.argCountCache[key];
    }
    //
    if (s.length < argCount) {
        s[argCount] = vuexArg;
    }
    else {
        s.push(vuexArg);
    }
    return s;
}
//
const R_DEFAULT_ARGS = /var.*=\s*arguments.length\s*>\s*[0-9]+\s*&&\s*arguments\[[0-9]+\]\s*!==\s*undefined\s*\?\s*arguments\[[0-9]+\]\s*:\s*.*;/gm;
function getArgCount(fn) {
    let code = fn.toString();
    //console.log(code);
    //外部定义
    let argStr = code.slice(code.indexOf("(") + 1, code.indexOf(")"));
    let defaultArgs;
    if (argStr != "") {
        defaultArgs = argStr.split(",");
    }
    let defaultArgCount = 0;
    if (defaultArgs != null) {
        defaultArgCount = defaultArgs.length;
    }
    //获取方法体内部的默认参数
    let innerDefaultArgs = code.match(R_DEFAULT_ARGS);
    let innerDefaultArgCount = 0;
    if (innerDefaultArgs != null) {
        innerDefaultArgCount = innerDefaultArgs.length;
    }
    //console.log(innerDefaultArgCount, perDefaultArgCount);
    return innerDefaultArgCount + defaultArgCount;
}
//# sourceMappingURL=index.js.map