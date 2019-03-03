# vuex-class-component

> 使用 ECMAScript / TypeScript 类语法编写 Vuex 模块。可以使用类语法调用 store 的各种方法。

### Example

define moudles
@/store/modules/user.ts

```ts
import {
  VuexClass,
  Constructor,
  Getter,
  Mutation,
  Exclude
} from "vuex-class-component";

// state
@VuexClass({ name: "user" })
export default class UserState {
  //convert to => store.state.user.id
  //convert to => store.mutations["user/id"]
  public id: string = "id";

  //convert to => store.state.user.sex
  //convert to => store.getters["user/sex"]
  //convert to => store.mutations["user/sex"]
  @Getter
  public sex: number = 1;

  // since in VuexClass function
  // we will new UserState() to get some instance variables
  // so it's not recommand add initialize function here
  // instead use @Constructor
  // it'll be called when we new UserState()
  constructor() {}

  @Constructor
  public init() {}

  //convert to => store.getters["user/getNameWithSex"]
  @Getter
  public getNameWithSex(sex: number): string {
    if (sex == 1) {
      return sex + "_" + this._name;
    }
    return this._name;
  }

  //convert to => store.mutations["user/setNameWithSex"]
  @Mutation
  public setNameWithSex(sex: number) {
    if (sex == 1) {
      this._name = sex + "_" + this._name;
    }
  }

  //convert to => store.actions["user/change"]
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

  // won't add to store instance
  @Exclude
  private doTest() {
    console.log("just a test");
  }
}
```

define store
@/store/index.ts

```ts
import Vue from "vue";
import Vuex from "vuex";
import User from "./modules/user";
import { createStore } from "./vuex-class-component";

Vue.use(Vuex);

//modules
export let user: User = new User();

//store
const store = createStore(false, {
  user
});
export default store;
```

use in .vue
@/app.vue

```ts
<template>
  <div id="app"></div>
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

### @VuexClass

```ts
//1.namespaced=false
@VuexClass
export default class App {}

//2.namaspaced=true
@VuexClass({ name: "app" })
export default class App {}
```

### use "root"

```ts
let root = new Root();
let user = new User();
const store = createStore(false, {
  root: root,
  user,
  ...
});
```

### get vuex args inside function

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

### support arg default value

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
