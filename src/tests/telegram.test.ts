import { buildScript } from '../services/telegram';

jest.mock('node-fetch');

describe('buildScript', () => {
  it('replaces all template variables', () => {
    const template = 'Hey {{handle}}, shill {{cashtag}} today. Angle: {{angle}}';
    const result = buildScript(template, {
      handle: '@cryptomoon',
      cashtag: '$ASPEN',
      angle: 'morning momentum',
    });
    expect(result).toBe('Hey @cryptomoon, shill $ASPEN today. Angle: morning momentum');
  });

  it('leaves unknown vars as-is', () => {
    const result = buildScript('Hey {{handle}} — {{unknown}}', { handle: '@test' });
    expect(result).toBe('Hey @test — {{unknown}}');
  });

  it('handles template with no placeholders', () => {
    const result = buildScript('Just a plain message', {});
    expect(result).toBe('Just a plain message');
  });

  it('handles empty template', () => {
    const result = buildScript('', { handle: '@test' });
    expect(result).toBe('');
  });

  it('replaces the same variable multiple times', () => {
    const result = buildScript('{{cashtag}} is live! Buy {{cashtag}} now!', { cashtag: '$ASPEN' });
    expect(result).toBe('$ASPEN is live! Buy $ASPEN now!');
  });

  it('handles multiline template', () => {
    const template = 'Hey {{handle}},\n\n{{angle}}\n\nTag {{cashtag}}';
    const result = buildScript(template, {
      handle: '@moon', angle: 'big move incoming', cashtag: '$ASPEN',
    });
    expect(result).toBe('Hey @moon,\n\nbig move incoming\n\nTag $ASPEN');
  });

  it('does not corrupt special characters in values', () => {
    const result = buildScript('{{handle}} says: $$$', { handle: '@degen_alpha' });
    expect(result).toBe('@degen_alpha says: $$$');
  });
});
