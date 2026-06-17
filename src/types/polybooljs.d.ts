declare module "polybooljs" {
  interface PolyBoolStatic {
    epsilon(value: number): void;
    buildLog(value: boolean): void;
  }

  const PolyBool: PolyBoolStatic;
  export default PolyBool;
}
