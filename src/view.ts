import { ItemView, WorkspaceLeaf } from "obsidian";
import { VIEW_TYPE_STATS_TRACKER } from "./constants";
import * as ReactDOM from "react-dom";
import * as React from "react";
import Calendar from "./calendar";
import '../styles.css';

export default class StatsTrackerView extends ItemView {
    private dayCounts: Record<string, number>;

    constructor(leaf: WorkspaceLeaf, dayCounts: Record<string, number>) {
        super(leaf);
        this.dayCounts = dayCounts;

        this.registerInterval(
            window.setInterval(() => {
                ReactDOM.render(React.createElement(Calendar, {
                    data: Object.keys(this.dayCounts).map(day => {
                        return { "date": new Date(new Date(day).setMonth(new Date(day).getMonth() + 1)), "count": this.dayCounts[day] }
                    }),
                }), (this as any).contentEl);
            }, 1000)
        );
    }

    getDisplayText() {
        return "Daily Stats";
    }

    getIcon() {
        return "calendar-with-checkmark";
    }

    getViewType() {
        return VIEW_TYPE_STATS_TRACKER;
    }

    async onOpen() {
        ReactDOM.render(React.createElement(Calendar, {
            data: Object.keys(this.dayCounts).map(day => {
                return { "date": new Date(new Date(day).setMonth(new Date(day).getMonth() + 1)), "count": this.dayCounts[day] }
            }),
        }), (this as any).contentEl);
    }
}