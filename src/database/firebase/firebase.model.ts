interface PointHistory {
  activity: string;
  point: number;
  timestamp: {
    _seconds: number;
    _nanoseconds: number;
  };
}

export { PointHistory };
