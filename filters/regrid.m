clear

N = 5;
x = [1,1,1,1,1,1];
t = [0,1.5,3,4,5,6];
j = 1;
for i = 1:N
  tg(i) = i;
  Ng(i) = 0;
  xg(i) = 0;
  while (t(j) <= tg(i))
    xg(i) = xg(i)+x(j);
    Ng(i) = Ng(i)+1;
    if (j == length(t))
        break;
    end
    j     = j+1;

  end
  if (Ng(i) > 0)
    xg(i) = xg(i)/Ng(i);
  else
    xg(i) = NaN;
  end  
end
xg
tg
