import Vuex from "vuex";
//Plugin
const actionName = "__vcc_act_name";
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
    let op = {};
    op.strict = strict;
    if (modules.root) {
        op.state = modules.root.state;
        op.getters = modules.root.getters;
        op.actions = modules.root.actions;
        op.mutations = modules.root.mutations;
    }
    for (let name in modules) {
        if (name !== "root") {
            (op.modules || (op.modules = {}))[name] = modules[name];
        }
    }
    op.plugins = [VuexClassPlugin];
    if (plugins && plugins.length > 0) {
        for (let i = 0, len = plugins.length; i < len; i++) {
            op.plugins.push(plugins[i]);
        }
    }
    return op;
}
//------------------------------------------------------------------------------------------------------------------------
//Getter修饰器,标记为Getter
const getterKeys = "$getter$";
export function Getter(target, name, desc) {
    (target[getterKeys] || (target[getterKeys] = {}))[name] = 1;
    return desc;
}
//Mutation修饰器,标记为Mutation
const mutationKeys = "$mutation$";
export function Mutation(target, name, desc) {
    (target[mutationKeys] || (target[mutationKeys] = {}))[name] = 1;
    return desc;
}
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
    const vm = {
        namespaced: options.name ? true : false,
        moduleName: options.name ? options.name : "",
        state: {},
        getters: {},
        mutations: {},
        actions: {},
        store: undefined
    };
    //State
    const instance = new construct();
    Object.keys(instance).forEach((key) => {
        //实例属性设置state
        vm.state[key] = instance[key];
        //设置实例属性getter/setter
        const vuexKey = vm.namespaced ? vm.moduleName + "/" + key : key;
        let get, set;
        //如果属性需要挂在的Mutation上
        if (base[getterKeys] && base[getterKeys][key]) {
            vm.getters[key] = (s, g, rs, rg) => {
                return s[key];
            };
            get = () => {
                if (vm.store) {
                    return vm.store.getters[vuexKey];
                }
                return vm.state[key];
            };
        }
        else {
            get = () => {
                //当Store初始化完成后，直接代理成对store.state的访问
                if (vm.store) {
                    let state = vm.store.state;
                    return vm.namespaced ? state[vm.moduleName][key] : state[key];
                }
                //当Store未初始化时，直接读取当前state的值
                return vm.state[key];
            };
        }
        //如果属性需要挂在的Mutation上
        if (base[mutationKeys] && base[mutationKeys][key]) {
            vm.mutations[key] = (state, payload) => {
                state[key] = payload;
            };
            set = (payload) => {
                if (vm.store) {
                    vm.store.commit(vuexKey, payload);
                }
                else {
                    vm.state[key] = payload;
                }
            };
        }
        else {
            //写入state
            set = (payload) => {
                //当Store初始化完成后，直接代理成对store.state的访问
                if (vm.store) {
                    let state = vm.store.state;
                    vm.namespaced
                        ? (state[vm.moduleName][key] = payload)
                        : (state[key] = payload);
                }
                else {
                    //当Store未初始化时，直接设置当前state的值
                    vm.state[key] = payload;
                }
            };
        }
        Object.defineProperty(vm, key, { get, set });
    });
    //获取类对象属性
    Object.getOwnPropertyNames(base).forEach(key => {
        if (key === "constructor" || key === getterKeys || key === mutationKeys) {
            return;
        }
        //
        const vuexKey = vm.namespaced ? vm.moduleName + "/" + key : key;
        const desc = Object.getOwnPropertyDescriptor(base, key);
        //console.log(key, descriptor);
        const newDesc = {
            configurable: desc.configurable,
            enumerable: desc.enumerable
        };
        //getters  get 实例方法
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
                return vm.store.getters[vuexKey];
            };
        }
        //mutations set 实例方法
        if (typeof desc.set === "function") {
            vm.mutations[key] = (state, payload) => {
                desc.set.apply(vm, [
                    payload,
                    { state: state, store: vm.store }
                ]);
            };
            newDesc.set = (payload) => {
                vm.store.commit(vuexKey, payload);
            };
        }
        //getter / mutation / action
        if (typeof desc.value === "function") {
            if (base[getterKeys] && base[getterKeys][key]) {
                //getters
                vm.getters[key] = (s, g, rs, rg) => {
                    return (...payloads) => {
                        return desc.value.apply(vm, [
                            ...payloads,
                            {
                                state: s,
                                getters: g,
                                rootState: rs,
                                rootGetters: rg,
                                store: vm.store
                            }
                        ]);
                    };
                };
                newDesc.get = () => {
                    return vm.store.getters[vuexKey];
                };
                //
                //mutations
            }
            else if (base[mutationKeys] && base[mutationKeys][key]) {
                vm.mutations[key] = (state, payloads) => {
                    desc.value.apply(vm, [
                        ...payloads,
                        { state: state, store: vm.store }
                    ]);
                };
                newDesc.get = () => {
                    return (...payloads) => {
                        vm.store.commit(vuexKey, payloads);
                    };
                };
                //
                //actions
            }
            else {
                vm.actions[key] = (context, payloads) => {
                    return desc.value.apply(vm, [
                        ...payloads,
                        { context: context, store: vm.store }
                    ]);
                };
                newDesc.value = (...payloads) => {
                    return vm.store.dispatch(vuexKey, payloads);
                };
            }
        }
        //
        Object.defineProperty(vm, key, newDesc);
    });
    //删除key
    delete base[getterKeys];
    delete base[mutationKeys];
    //接收一个全局action
    vm.actions[actionName] = {
        root: true,
        handler: (ctx, store) => {
            vm.store = store;
        }
    };
    //
    construct.prototype = vm;
    return construct;
}
//# sourceMappingURL=vuex-class-component.js.map