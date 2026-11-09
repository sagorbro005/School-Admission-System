import { Clock3 } from "lucide-react";

export function Campus() {
  return (
    <div aria-hidden="true" className="campus">
      <i className="sun" />
      <i className="cloud cloud-left" />
      <i className="cloud cloud-right" />
      <i className="hill hill-back" />
      <i className="hill hill-front" />
      <i className="tree tree-left" />
      <i className="tree tree-right" />
      <div className="school">
        <div className="wing wing-left" />
        <div className="wing wing-right" />
        <div className="tower">
          <i className="flag" />
          <Clock3 />
          <i className="door" />
        </div>
      </div>
    </div>
  );
}
