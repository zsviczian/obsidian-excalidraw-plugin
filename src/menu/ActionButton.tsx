import * as React from "react";
import { Notice } from "obsidian";

type ButtonProps = {
  title: string;
  action: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
  longpress?: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
  icon: JSX.Element;
};

type ButtonState = {
  visible: boolean;
};

export class ActionButton extends React.Component<ButtonProps, ButtonState> {
  toastMessageTimeout: number = 0;
  longpressTimeout: number = 0;

  constructor(props: ButtonProps) {
    super(props);
    this.state = {
      visible: true,
    };
  }

  componentWillUnmount(): void {
    this.render = () => null;
  }

  render() {
    return (
      <button
        style={{
          //width: "fit-content",
          //padding: "2px",
          //margin: "4px",
        }}
        className="ToolIcon_type_button ToolIcon_size_small ToolIcon_type_button--show ToolIcon"
        title={this.props.title}
        onClick={(event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
          if (this.toastMessageTimeout) {
            window.clearTimeout(this.toastMessageTimeout);
            this.toastMessageTimeout = 0;
            this.props.action(event); //don't invoke the action on long press
          }
          if (this.longpressTimeout) {
            window.clearTimeout(this.longpressTimeout);
            this.longpressTimeout = 0;
          }
        }}
        onPointerDown={(event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
          this.toastMessageTimeout = window.setTimeout(
            () => {
              new Notice(this.props.title, 3000);
              //this.props.view.excalidrawAPI?.setToast({message:this.props.title, duration: 3000, closable: true});
              this.toastMessageTimeout = 0;
            },
            400,
          );
          this.longpressTimeout = window.setTimeout(
            () => {
              if(this.props.longpress) {
                this.props.longpress(event);
              } else {
                new Notice("Cannot pin this action", 3000);
                //this.props.view.excalidrawAPI?.setToast({message:"Cannot pin this action", duration: 3000, closable: true});
              }
              this.longpressTimeout = 0;
            },
            1500
          )
        }}
      >
        <div className="ToolIcon__icon" aria-hidden="true">
          {this.props.icon}
        </div>
      </button>
    );
  }
}
