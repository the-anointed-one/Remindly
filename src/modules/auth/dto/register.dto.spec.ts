import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { RegisterDto } from '../dto/register.dto';

describe('RegisterDto — password validation', () => {
  async function validatePassword(password: string) {
    const dto = plainToInstance(RegisterDto, {
      email: 'test@example.com',
      tenantName: 'Test Business',
      password,
    });
    const errors = await validate(dto);
    return errors.find((e) => e.property === 'password');
  }

  it('should reject password with no uppercase', async () => {
    const error = await validatePassword('password1!');
    expect(error).toBeDefined();
  });

  it('should reject password with no lowercase', async () => {
    const error = await validatePassword('PASSWORD1!');
    expect(error).toBeDefined();
  });

  it('should reject password with no number', async () => {
    const error = await validatePassword('Password!');
    expect(error).toBeDefined();
  });

  it('should reject password with no special character', async () => {
    const error = await validatePassword('Password1');
    expect(error).toBeDefined();
  });

  it('should reject password shorter than 8 characters', async () => {
    const error = await validatePassword('Pa1!');
    expect(error).toBeDefined();
  });

  it('should accept a valid strong password', async () => {
    const error = await validatePassword('Password1!');
    expect(error).toBeUndefined();
  });

  it('should accept another valid strong password', async () => {
    const error = await validatePassword('Str0ng#Pass');
    expect(error).toBeUndefined();
  });
});
