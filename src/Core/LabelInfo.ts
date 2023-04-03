/**
 * Information about a label.
 * @interface
 * @property {string} label - The label.
 * @property {number} angle - The angle of the label.
 * @property {number} diff - The difference between the angle and the angle of the label.
 */
export interface LabelInfo {
  label: string;
  angle: number;
  diff: number;
}
