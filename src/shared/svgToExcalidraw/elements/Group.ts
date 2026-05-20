import { randomId } from "../utils";
import { presAttrsToElementValues } from "../attributes";
import { ExcalidrawElementBase } from "../elements/ExcalidrawElement";

export function getGroupAttrs(groups: Group[]): Record<string, unknown> {
  return groups.reduce((acc, { element }) => {
    const elVals = presAttrsToElementValues(element);

    return { ...acc, ...elVals };
  }, {} as Partial<ExcalidrawElementBase>);
}

class Group {
  id = randomId();

  element: Element;

  constructor(element: Element) {
    this.element = element;
  }
}

export default Group;
