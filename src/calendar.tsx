import * as React from "react";
import ReactCalendarHeatmap from "react-calendar-heatmap";
import ReactTooltip from "react-tooltip";

interface HeatmapProps {
    data: any[];
}

const MAX_COLORS = 5;
const COLOR_FREQ = 6;

class Heatmap extends React.Component<HeatmapProps> {
    render() {
        const customTooltipDataAttrs = (value: any) => ({
            'data-tip': value.date === null ? '' : value.status + ' on ' + value.date
        });

        return <div style={{ padding: "10px 10px 0px 10px", maxWidth: "300px", marginLeft: "auto", marginRight: "auto" }}>
            <ReactCalendarHeatmap
                startDate={new Date(new Date().setFullYear(new Date().getFullYear() - 1))}
                endDate={new Date()}
                values={this.props.data}
                horizontal={false}
                showMonthLabels={false}
                classForValue={(value) => {
                    if (!value || value.count == 0) {
                        return 'color-empty';
                    }
                    return `color-github-${Math.min(MAX_COLORS, Math.floor(Math.log(value.count) / Math.log(COLOR_FREQ)))}`;
                }}
                tooltipDataAttrs={customTooltipDataAttrs}
            />
            <ReactTooltip
                type='warning'
                effect='solid'
            />
        </div>
    }
}

export default Heatmap;