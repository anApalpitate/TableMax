import { trackPlaybackVolume } from '@tablemax/web-host';
import { useEffect, useRef } from 'react';
import { claimAudioEvent } from '@tablemax/web-host';
import { tile, tileNames } from '../rules/data';
import type { Scene } from '../rules/state';
import { SunDisk, TableArt, TileFace } from './art';
import { raSound } from './feedback';
import './entrance.css';

function entranceSound(scene: Scene) {
  if (scene.kind === 'ra' || scene.kind === 'auction') return 'open';
  if (scene.kind === 'settlement') return scene.epoch === 3 ? 'final' : 'epoch';
  return scene.kind;
}

const titles = {
  ra: '太阳神降临',
  auction: '开始拍卖',
  won: '成交',
  god: '神迹替换',
  disaster: '灾难',
  settlement: '时代结束',
};

export function RaEntrance({
  scene,
  soundKey,
  reducedMotion,
  audioEnabled,
}: {
  scene: Scene;
  soundKey: string;
  reducedMotion: boolean;
  audioEnabled: boolean;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const cue = entranceSound(scene);
  const sound = raSound(cue);
  const disaster = scene.kind === 'disaster' ? tile(scene.id).face : undefined;

  useEffect(() => {
    const element = audio.current;
    if (!audioEnabled || !element || !sound) return;
    const untrackVolume = trackPlaybackVolume(element);
    let cancelled = false;
    const timer = window.setTimeout(
      () => {
        void Promise.resolve(claimAudioEvent(`${soundKey}:${cue}`))
          .then((claimed) => {
            if (claimed && !cancelled) void element.play().catch(() => {});
          })
          .catch(() => {});
      },
      reducedMotion ? 0 : 460,
    );
    return () => {
      untrackVolume();
      cancelled = true;
      window.clearTimeout(timer);
      element.pause();
    };
  }, [cue, audioEnabled, reducedMotion, sound, soundKey]);

  return (
    <>
      <audio
        ref={audio}
        src={audioEnabled ? sound : undefined}
        preload="auto"
      />
      <div className="ra-entrance-veil" />
      <div className="ra-entrance-rays" />
      <div className="ra-entrance-emblem">
        <span className="ra-entrance-halo" />
        <span className="ra-entrance-shape" />
        <div className="ra-entrance-subject">
          {scene.kind === 'ra' && <TileFace tile={tile('ra-1')} decorative />}
          {scene.kind === 'auction' && (
            <TableArt piece="ra-statue" className="ra-entrance-art" />
          )}
          {scene.kind === 'won' && <SunDisk value={scene.disk} />}
          {scene.kind === 'god' && (
            <TileFace tile={tile(scene.godId)} decorative />
          )}
          {scene.kind === 'disaster' && (
            <TileFace tile={tile(scene.id)} decorative />
          )}
          {scene.kind === 'settlement' && (
            <TableArt piece="sun-boat" className="ra-entrance-art" />
          )}
        </div>
      </div>
      <div className="ra-entrance-banner">
        <strong>{disaster ? tileNames[disaster] : titles[scene.kind]}</strong>
      </div>
      <div className="ra-entrance-sweep" />
    </>
  );
}
