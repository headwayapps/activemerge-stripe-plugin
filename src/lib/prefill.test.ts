import {buildItems, normalise, prefillFields, splitPlaceholders} from './prefill';

describe('prefill', () => {
  it('matches placeholders regardless of case, spaces and underscores', () => {
    const values = {[normalise('customer_name')]: 'Acme', [normalise('email')]: 'a@acme.com'};
    expect(prefillFields(['Customer Name', 'EMAIL', 'Unknown'], values)).toEqual({
      'Customer Name': 'Acme',
      EMAIL: 'a@acme.com',
      Unknown: '',
    });
  });

  it('separates line-item columns from document fields', () => {
    expect(splitPlaceholders(['Name', 'item.Description', 'item.Unit Price', 'Name'])).toEqual({
      fields: ['Name'],
      itemColumns: ['Description', 'Unit Price'],
    });
  });

  it('keys item rows the way the template processor reads them', () => {
    const rows = [{description: 'Seat', unitprice: '$5.00'}];
    expect(buildItems(['Description', 'Unit Price', 'Missing'], rows)).toEqual([
      {Description: 'Seat', Unit_Price: '$5.00', Missing: ''},
    ]);
  });
});
