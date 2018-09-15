# vuex-class-component

> 使用 ECMAScript / TypeScript 类语法编写 Vuex 模块。可以使用类语法调用 store 的各种方法。

### Example

定义子模块
@/store/modules/user.ts

```ts
import { VuexClass, Getter, Mutation } from "vuex-class-component";

// state 用户数据类型定义
@VuexClass({ name: "user" })
export default class UserState {
  //实例属性自动转换为store.state.user 属性
  public id: string = "id";

  //手动编写getter/setter属性
  private _name: string = "";
  //setter设置为store.mutations
  public set name(name: string) {
    this._name = name;
  }
  //getter设置为store.getters
  public get name(): string {
    return this._name;
  }

  //使用Getter修饰属性，把属性设置为store.getters["user/sex"]
  @Getter
  public sex: number = 1;

  //使用Mutation修饰属性，把属性设置为store.mutations["user/birth"]
  @Mutation
  public birth: string = "1970-01-01";

  //也可以同时修饰
  @Getter
  @Mutation
  public nickName: string = "";

  //把方法设置为Getter
  @Getter
  public getNameWithSex(sex: number): string {
    if (sex == 1) {
      return sex + "_" + this._name;
    }
    return this._name;
  }

  //把方法设置为Mutation
  @Mutation
  public setNameWithSex(sex: number) {
    if (sex == 1) {
      this._name = sex + "_" + this._name;
    }
  }

  // 普通方法设置为Action，参数可以随意设置
  public change(newName: string, newSex: number): Promise<any> {
    return http
      .request({
        url: "/user_change",
        method: "post",
        data: {
          newName,
          newSex
        }
      })
      .then(
        (response: any): any => {
          return response;
        }
      );
  }
}
```

定义 store
@/store/index.ts

```ts
import Vue from "vue";
import Vuex from "vuex";
import User from "./modules/user";
import { createStore } from "./vuex-class-component";

Vue.use(Vuex);

//子模块
export let user: User = new User();

//store
const store = createStore(false, {
  user
});
export default store;
```

在 vue 中调用
@/app.vue

```vue
<template>
  <div id="app">
  </div>
</template>

<script lang="ts">
import { Component, Vue } from "vue-property-decorator";
import store, { user } from "@/store";

@Component
export default class App extends Vue {
  created() {
    //state
    console.log(store.state.user.id, user.id);

    //getter
    console.log(store.getters["user/name"], user.name);
    console.log(
      store.getters["user/getNameWithSex"]("1"),
      user.getNameWithSex("1")
    );

    //mutation
    store.commit("user/nickName", "nickName");
    user.nickName = "nickName";
    store.commit("user/setNameWithSex", "1");
    user.setNameWithSex("1");

    //action
    store.dispatch("user.change", ["newName", "newSex"]); //store方式调用action ，不支持多参数
    user.change("newName", "newSex");
  }
}
</script>
```

### @VuexClass 修饰器

```ts
//1.没有参数，模块namespaced=false
@VuexClass
export default class App {}

//2.有参数，设置子模块磨成,namaspaced=true，store中使用 "app/**" 访问
@VuexClass({ name: "app" })
export default class App {}
```

### 创建 store 时，root 选项可以指定根 state

```ts
let root = new Root();
let user = new User();
const store = createStore(false, {
  root: root,
  user,
  ...
});
```

### 类内部可以获取 vuex 传入参数

```ts
import {GetterArgs,MutationArgs,ActionArgs} from "vuex-class-component"
//Getter
public get name():string{
    let args:GetterArgs=arguments[arguments.length-1]
    ...
}
//Mutation
public set name():string{
    let args:MutationArgs=arguments[arguments.length-1]
    ...
}
//Action
public change(newName:string,newSex:number):any{
    let args:ActionArgs=arguments[arguments.length-1]
    ...
}
```

### 类方法支持默认参数

```ts
import {Getter,Mutation,GetterArgs,MutationArgs,ActionArgs} from "vuex-class-component"

@Getter
public getByID(id:number=1):any{
    let args:GetterArgs=arguments[arguments.length-1]
    ...
}

@Mutation
public getByName(name:string="aaa"):any{
    let args:MutationArgs=arguments[arguments.length-1]
    ...
}

//
public change(newName:string,newSex:number="default"):any{
    let args:ActionArgs=arguments[arguments.length-1]
    ...
}
```
