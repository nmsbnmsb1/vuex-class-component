import Vuex, { Store, StoreOptions, Plugin } from "vuex";

//Plugin
const actionName: string = "__vcc_act_name";
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
  let op: StoreOptions<any> = {};
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
    for (let i: number = 0, len: number = plugins.length; i < len; i++) {
      op.plugins.push(plugins[i]);
    }
  }
  return op;
}

//------------------------------------------------------------------------------------------------------------------------
//Getter修饰器,标记为Getter
const getterKeys: string = "$getter$";
export function Getter(
  target: any,
  name: string,
  desc?: PropertyDescriptor
): any {
  (target[getterKeys] || (target[getterKeys] = {}))[name] = 1;
  return desc;
}

//Mutation修饰器,标记为Mutation
const mutationKeys: string = "$mutation$";
export function Mutation(
  target: any,
  name: string,
  desc?: PropertyDescriptor
): any {
  (target[mutationKeys] || (target[mutationKeys] = {}))[name] = 1;
  return desc;
}

//
interface VuexModule {
  namespaced: boolean;
  moduleName: string;
  state: any;
  getters: any;
  actions: any;
  mutations: any;
  store: Store<any> | undefined;
  argCountCache: { [key: string]: number };
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
  const vm: VuexModule = {
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
  const instance: any = new construct();
  Object.keys(instance).forEach((key: string) => {
    //实例属性设置state
    vm.state[key] = instance[key];

    //设置实例属性getter/setter
    const vuexKey: string = vm.namespaced ? vm.moduleName + "/" + key : key;
    let get: any, set: any;
    //如果属性需要挂在的Mutation上
    if (base[getterKeys] && base[getterKeys][key]) {
      vm.getters[key] = (s: any, g: any, rs: any, rg: any): any => {
        return s[key];
      };
      get = () => {
        if (vm.store) {
          return (vm.store as Store<any>).getters[vuexKey];
        }
        return vm.state[key];
      };
    } else {
      get = () => {
        //当Store初始化完成后，直接代理成对store.state的访问
        if (vm.store) {
          let state = (vm.store as Store<any>).state;
          return vm.namespaced ? state[vm.moduleName][key] : state[key];
        }
        //当Store未初始化时，直接读取当前state的值
        return vm.state[key];
      };
    }

    //如果属性需要挂在的Mutation上
    if (base[mutationKeys] && base[mutationKeys][key]) {
      vm.mutations[key] = (state: any, payload: any) => {
        state[key] = payload;
      };
      set = (payload: any) => {
        if (vm.store) {
          (vm.store as Store<any>).commit(vuexKey, payload);
        } else {
          vm.state[key] = payload;
        }
      };
    } else {
      //写入stateF
      set = (payload: any) => {
        //当Store初始化完成后，直接代理成对store.state的访问
        if (vm.store) {
          let state = (vm.store as Store<any>).state;
          vm.namespaced
            ? (state[vm.moduleName][key] = payload)
            : (state[key] = payload);
        } else {
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
        return (vm.store as Store<any>).getters[vuexKey];
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
        (vm.store as Store<any>).commit(vuexKey, payload);
      };
    }

    //getter / mutation / action
    if (typeof desc.value === "function") {
      if (base[getterKeys] && base[getterKeys][key]) {
        //getters
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
          return (vm.store as Store<any>).getters[vuexKey];
        };
        //
        //mutations
      } else if (base[mutationKeys] && base[mutationKeys][key]) {
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
            (vm.store as Store<any>).commit(vuexKey, payloads);
          };
        };
        //
        //actions
      } else {
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
          return (vm.store as Store<any>).dispatch(vuexKey, payloads);
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
    handler: (ctx: any, store: Store<any>) => {
      vm.store = store;
    }
  };

  //
  construct.prototype = vm;
  return construct;
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
