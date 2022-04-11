import * as React from "react";
import ExcalidrawView from "../ExcalidrawView";

type ButtonProps = {
  title: string;
  action: Function;
  icon: JSX.Element;
  view: ExcalidrawView;
};

type ButtonState = {
  visible: boolean;
};

export class ActionButton extends React.Component<ButtonProps, ButtonState> {
  toastMessageTimeout: number = 0;

  constructor(props: ButtonProps) {
    super(props);
    this.state = {
      visible: true,
    };
  }

  render() {
    return (
      <button
        style={{
          width: "fit-content",
          padding: "2px",
          margin: "4px",
        }}
        className="ToolIcon_type_button ToolIcon_size_small ToolIcon_type_button--show ToolIcon"
        title={this.props.title}
        onClick={(event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
          if (this.toastMessageTimeout) {
            window.clearTimeout(this.toastMessageTimeout);
            this.toastMessageTimeout = 0;
          }
          this.props.action(event);
        }}
        onPointerDown={() => {
          this.toastMessageTimeout = window.setTimeout(
            () =>
              this.props.view.excalidrawAPI?.setToastMessage(this.props.title),
            300,
          );
        }}
      >
        <div className="ToolIcon__icon" aria-hidden="true">
          {this.props.icon}
        </div>
      </button>
    );
  }
}
