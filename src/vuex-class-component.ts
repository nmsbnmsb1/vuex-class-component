import Vuex, { Store, StoreOptions, Plugin } from "vuex";

//Plugin
const actionName: string = "__vcc_action";
export const VuexClassPlugin: Plugin<any> = (store: Store<any>) => {
  // 把 store 传入所有的实例中
  store.dispatch(actionName, store);
};

export interface Modules {
  [name: string]: any;
}

//创建Vuex.Store
export function createStore(
  strict: boolean,
  modules: Modules,
  plugins?: Plugin<any>[]
): Store<any> {
  return new Vuex.Store<any>(createOptions(strict, modules, plugins));
}

//创建VuexOptions
export function createOptions(
  strict: boolean,
  modules: Modules,
  plugins?: Plugin<any>[]
): StoreOptions<any> {
  let opt: StoreOptions<any> = {};
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
    for (let i: number = 0, len: number = plugins.length; i < len; i++) {
      opt.plugins.push(plugins[i]);
    }
  }
  return opt;
}

//------------------------------------------------------------------------------------------------------------------------
function donothing(target: any, key: string, desc?: PropertyDescriptor): any {
  return desc;
}
function marker(marker: string) {
  return function(target: any, key: string, desc?: PropertyDescriptor): any {
    (target[marker] || (target[marker] = {}))[key] = 1;
    return desc;
  };
}
function hasMarker(target: any, marker: string, key: string): boolean {
  return target[marker] && target[marker][key];
}
// function defaultMarker(target: any, key: string): boolean {
//   return (
//     !hasMarker(target, stateKey, key) &&
//     !hasMarker(target, getterKey, key) &&
//     !hasMarker(target, mutationKey, key) &&
//     !hasMarker(target, actionKey, key) &&
//     !hasMarker(target, excludeKey, key)
//   );
// }

const constructorKey: string = "$_constructor_$";
//const stateKey: string = "$_state_$";
const getterKey: string = "$_getter_$";
const mutationKey: string = "$_mutation_$";
//const actionKey: string = "$_action_$";
const excludeKey: string = "$_exclude_$";

export let Constructor = function(
  target: any,
  key: string,
  desc?: PropertyDescriptor
): any {
  target[constructorKey] = key;
  return desc;
};
export let State = donothing;
export let Getter = marker(getterKey);
export let Mutation = marker(mutationKey);
export let Action = donothing;
export let Exclude = marker(excludeKey);

//
interface VuexModule {
  sign?: string;
  base: any;
  namespaced: boolean;
  moduleName: string;
  state: any;
  getters: any;
  actions: any;
  mutations: any;
  store: Store<any> | undefined;
  argCountCache: { [key: string]: number };
  [key: string]: any;
}

export interface GetterArgs {
  state: any;
  getters: any;
  rootState: any;
  rootGetters: any;
  store: Store<any>;
}

export interface MutationArgs {
  state: any;
  store: Store<any>;
}

export interface ActionArgs {
  context: any;
  store: Store<any>;
}

export interface VuexClassOptions {
  name?: string;
}

//模块修饰器
export function VuexClass(options?: VuexClassOptions | Function): any {
  if (typeof options === "function") {
    return moduleFactory(options);
  }
  return function(construct: any): any {
    return moduleFactory(construct, options);
  };
}

//动态的生成Vuex模块
function moduleFactory(construct: any, options: VuexClassOptions = {}): any {
  const base: any = construct.prototype;

  //新的基类
  const vm: VuexModule = {
    base,
    namespaced: options.name ? true : false,
    moduleName: options.name ? (options.name as string) : "",
    state: {},
    getters: {},
    mutations: {},
    actions: {},
    store: undefined,
    argCountCache: {}
  };

  //State
  let instance: any = new construct();
  //console.log(construct.toString());
  Object.keys(instance).forEach((key: string) => {
    //如果只是一个安静的美属性
    if (hasMarker(instance, excludeKey, key)) {
      vm[key] = instance[key];
      return;
    }

    //实例属性设置state
    const vuexKey: string = vm.namespaced ? vm.moduleName + "/" + key : key;
    const newDesc: PropertyDescriptor = {
      // configurable: desc.configurable,
      // enumerable: desc.enumerable
    };

    vm.state[key] = instance[key];

    //@Getter
    if (hasMarker(instance, getterKey, key)) {
      vm.getters[key] = (s: any, g: any, rs: any, rg: any): any => {
        return s[key];
      };
      newDesc.get = () => {
        return vm.store
          ? (vm.store as Store<any>).getters[vuexKey]
          : vm.state[key];
      };
    } else {
      newDesc.get = () => {
        //当Store初始化完成后，直接代理成对store.state的访问
        if (vm.store) {
          let state = (vm.store as Store<any>).state;
          return vm.namespaced ? state[vm.moduleName][key] : state[key];
        }
        return vm.state[key];
      };
    }

    //@Mutation
    vm.mutations[key] = (state: any, payload: any) => {
      state[key] = payload;
    };
    newDesc.set = (payload: any) => {
      vm.store
        ? (vm.store as Store<any>).commit(vuexKey, payload)
        : (vm.state[key] = payload);
    };

    Object.defineProperty(vm, key, newDesc);
  });
  instance = null;

  //获取类对象属性
  Object.getOwnPropertyNames(base).forEach(key => {
    if (key === "constructor" || (key.startsWith("$_") && key.endsWith("_$")))
      return;

    //
    if (hasMarker(base, excludeKey, key)) {
      vm[key] = base[key];
      return;
    } else if (base[constructorKey] && base[constructorKey] === key) {
      vm[constructorKey] = base[key];
      return;
    }
    //
    const vuexKey: string = vm.namespaced ? vm.moduleName + "/" + key : key;
    const desc = Object.getOwnPropertyDescriptor(
      base,
      key
    ) as PropertyDescriptor;
    //console.log(key, descriptor);
    const newDesc: PropertyDescriptor = {
      configurable: desc.configurable,
      enumerable: desc.enumerable
    };

    //getters  get 实例方法
    if (typeof desc.get === "function") {
      vm.getters[key] = (s: any, g: any, rs: any, rg: any): any => {
        return (desc.get as Function).apply(vm, [
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
          ? (vm.store as Store<any>).getters[vuexKey]
          : (desc.get as Function).apply(vm);
      };
    }

    //mutations set 实例方法
    if (typeof desc.set === "function") {
      vm.mutations[key] = (state: any, payload: any) => {
        (desc.set as Function).apply(vm, [
          payload,
          { state: state, store: vm.store }
        ]);
      };
      newDesc.set = (payload: any) => {
        vm.store
          ? (vm.store as Store<any>).commit(vuexKey, payload)
          : (desc.set as Function).apply(vm, [payload]);
      };
    }

    //getter / mutation / action
    if (typeof desc.value === "function") {
      if (hasMarker(base, getterKey, key)) {
        //@Getters
        vm.getters[key] = (s: any, g: any, rs: any, rg: any): any => {
          return (...payloads: any[]) => {
            return desc.value.apply(
              vm,
              getApplyArgs(vm, key, desc.value, [...payloads], {
                state: s,
                getters: g,
                rootState: rs,
                rootGetters: rg,
                store: vm.store as Store<any>
              })
            );
          };
        };
        newDesc.get = () => {
          return vm.store
            ? (vm.store as Store<any>).getters[vuexKey]
            : desc.value.apply(vm, arguments);
        };
        //
        //@Mutations
      } else if (hasMarker(base, mutationKey, key)) {
        vm.mutations[key] = (state: any, payloads: any) => {
          desc.value.apply(
            vm,
            getApplyArgs(vm, key, desc.value, [...payloads], {
              state: state,
              store: vm.store
            })
          );
        };
        newDesc.get = () => {
          return (...payloads: any[]) => {
            vm.store
              ? (vm.store as Store<any>).commit(vuexKey, payloads)
              : desc.value.apply(vm, payloads);
          };
        };
      } else {
        //@Action
        vm.actions[key] = (context: any, payloads: any): any => {
          return desc.value.apply(
            vm,
            getApplyArgs(vm, key, desc.value, [...payloads], {
              context: context,
              store: vm.store
            })
          );
        };
        newDesc.value = (...payloads: any[]): Promise<any> => {
          return vm.store
            ? (vm.store as Store<any>).dispatch(vuexKey, payloads)
            : desc.value.apply(vm, payloads);
        };
      }
    }
    Object.defineProperty(vm, key, newDesc);
  });

  //接收一个全局action
  vm.actions[actionName] = {
    root: true,
    handler: (ctx: any, store: Store<any>) => {
      vm.store = store;
    }
  };

  //删除key
  delete base[constructorKey];
  //delete base[stateKey];
  delete base[getterKey];
  delete base[mutationKey];
  //delete base[actionKey];
  delete base[excludeKey];
  construct.prototype = vm;
  //console.log(vm);

  //return  新的构造函数
  return function(...args: any[]) {
    let i = new construct();
    if (i[constructorKey]) i[constructorKey](...args);
    return i;
  };
}

function getApplyArgs(
  vm: VuexModule,
  key: string,
  fn: Function,
  s: any[],
  vuexArg: any
) {
  let argCount = 0;
  if (vm.argCountCache[key] == null) {
    argCount = getArgCount(fn);
    vm.argCountCache[key] = argCount;
  } else {
    argCount = vm.argCountCache[key];
  }
  //
  if (s.length < argCount) {
    s[argCount] = vuexArg;
  } else {
    s.push(vuexArg);
  }
  return s;
}

//
const R_DEFAULT_ARGS = /var.*=\s*arguments.length\s*>\s*[0-9]+\s*&&\s*arguments\[[0-9]+\]\s*!==\s*undefined\s*\?\s*arguments\[[0-9]+\]\s*:\s*.*;/gm;

function getArgCount(fn: Function): number {
  let code: string = fn.toString();
  //console.log(code);

  //外部定义
  let argStr: string = code.slice(code.indexOf("(") + 1, code.indexOf(")"));
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
