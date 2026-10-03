export const answers=[];
class Form {
  title(){return this;}body(){return this;}button(){return this;}button1(){return this;}button2(){return this;}
  dropdown(){return this;}toggle(){return this;}textField(){return this;}
  async show(player){const answer=answers.shift();return typeof answer==="function"?answer(player):answer??{canceled:true};}
}
export class ActionFormData extends Form{} export class MessageFormData extends Form{} export class ModalFormData extends Form{}
