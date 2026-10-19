import mandatoryMark from '../../../assets/games/pokemon-encounters/icons/ability-mandatory.svg';
import optionalMark from '../../../assets/games/pokemon-encounters/icons/ability-optional.svg';
import mixedMark from '../../../assets/games/pokemon-encounters/icons/ability-mixed.svg';
import type { AbilityMarkKind } from './ability-mark';

const icons = {
  mandatory: mandatoryMark,
  optional: optionalMark,
  mixed: mixedMark,
};

export function AbilityIcon({ kind }: { kind: AbilityMarkKind }) {
  return (
    <img
      className="ability-mark-icon"
      src={icons[kind]}
      alt=""
      draggable={false}
    />
  );
}
