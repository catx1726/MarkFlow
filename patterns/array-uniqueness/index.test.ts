import { getUniqueItems } from './index';

describe('getUniqueItems', () => {
  it('should return unique primitive items', () => {
    const input = [1, 2, 2, 3, 1];
    const output = getUniqueItems(input);
    expect(output).toEqual([1, 2, 3]);
  });

  it('should return unique object items', () => {
    const input = [{ id: 1 }, { id: 2 }, { id: 1 }];
    const output = getUniqueItems(input);
    expect(output).toEqual([{ id: 1 }, { id: 2 }]);
  });
});
