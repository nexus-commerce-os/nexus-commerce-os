import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Table, type TableColumn } from '../Table';

type Row = { id: string; name: string };

const columns: TableColumn<Row>[] = [{ key: 'name', header: 'Name', render: (r) => r.name }];

describe('Table', () => {
  it('renders headers and rows', () => {
    const rows: Row[] = [
      { id: '1', name: 'Jane' },
      { id: '2', name: 'Amir' },
    ];
    const { container } = render(<Table columns={columns} rows={rows} getRowKey={(r) => r.id} />);
    expect(container.querySelectorAll('th').length).toBe(1);
    expect(container.querySelectorAll('tbody tr').length).toBe(2);
    expect(container.querySelector('tbody td')?.textContent).toBe('Jane');
  });

  it('renders an empty state spanning all columns', () => {
    const { container } = render(
      <Table columns={columns} rows={[]} getRowKey={(r) => r.id} empty="Nothing yet" />,
    );
    const td = container.querySelector('.table-empty');
    expect(td?.textContent).toBe('Nothing yet');
    expect(td?.getAttribute('colspan')).toBe('1');
  });
});
