import type { AuctionKind } from '../view';

export const auctionNames: Record<AuctionKind, string> = {
  open: '公开竞价',
  once: '一次出价',
  sealed: '暗标拍卖',
  fixed: '一口价',
  double: '双重拍卖',
};
export const auctionMarks: Record<AuctionKind, string> = {
  open: '↗',
  once: '①',
  sealed: '✉',
  fixed: '$',
  double: 'Ⅱ',
};
export const money = (amount: number) =>
  `${amount.toLocaleString('zh-CN')} 千元`;
