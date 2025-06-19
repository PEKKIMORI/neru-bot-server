export interface ICacheSystemService {
  setValue<T>(key: string, value: T, time?: number): Promise<'OK'>;

  getValue<T>(key: string): Promise<T | null>;
}
