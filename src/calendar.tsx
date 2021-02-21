import * as React from "react";
import ReactCalendarHeatmap from "react-calendar-heatmap";
import ReactTooltip from "react-tooltip";

interface HeatmapProps {
    data: any[];
}

class Heatmap extends React.Component<HeatmapProps> {
    render() {
        const customTooltipDataAttrs = (value: any) => ({
            'data-tip': value.date === null ? '' : value.status + ' on ' + value.date
        });

        return <><ReactCalendarHeatmap
            startDate={new Date(new Date().setFullYear(new Date().getFullYear() - 1))}
            endDate={new Date()}
            values={this.props.data}
            horizontal={false}
            showMonthLabels={false}
            classForValue={(value) => {
                if (!value) {
                    return 'color-empty';
                }
                return `color-github-${value.count}`;
            }}
            tooltipDataAttrs={customTooltipDataAttrs}
        />
            <ReactTooltip
                type='warning'
                effect='solid'
            />
        </>
    }
}

export default Heatmap;