function [T,TS] = procOUSA(filename,cumulative)
% Must have two .xlsx files
% Call using e.g. procOUSA('2015-09',1);
% Second parameter boolean, true if process all months

if cumulative
    % Process all months
    year = filename(1:5);
    mon = str2double(filename(6:7));
    for i = 1:mon
        file = [year num2str(i,'%02.0f')];
        disp(file);
        [T,TS] = procOUSA(file,0);
    end
else
    % Process a single month

    % Make label map between accnt codes and department names
    labels = { ...
        'Admin'; ...
        'Management'; ...
        'Membership'; ...
        'Board'; ...
        'Fundraising'; ...
        'Vol. Appr.'; ...
        'Website'; ...
        'Awards'; ...
        'Archives'; ...
        'Source'; ...
        'Spec. Sess.'; ...
        'Ref. Lib.'; ...
        'Lend. Lib.'; ...
        'Convention'; ...
        'The Paper'; ...
        'The Fold'; ...
        'Development'; ...
        'Exhibition'; ...
        'Holiday Tree'; ...
        'OBC'; ...
        'Annual Gift'; ...
        'Publications'; ...
        'PCOC'; ...
        'COG serv.'; ...
        'O. Connect'};
    depts = [100;105;110;120;130;140;150;160;170; ...
             200;300;350;370;400;500;510;550; ...
             600;610;620;630;700;800;850;900];
    deptMap = containers.Map(depts,labels);
    
    nl = length(labels);

% Budget Processing

    % Import budget file as text
    data = importdata([filename '-budget.xlsx']);
    n = length(data.data(:,1));
    data.dept = zeros(n,1);
    data.cobj = zeros(n,1);
    data.textdata = data.textdata(2:end,:);
    % 2:end to skip first row (first line is blank)

    % Parse data file 
    for i = 1:n
        cll = data.textdata(i,2);
        % parse AC-CO in second column (AC department code, CO cost object)
        str = cll{1};
        if length(str) >= 7
            % has form AAA-BBB where AAA is CO and BBB is AC
            data.dept(i) = str2double(str(5:7));
            data.cobj(i) = str2double(str(1:3));
        end
    end

    % initialize budget table
    dept = zeros(nl,1);
    cobj = zeros(nl,1);
    rev_bgt_tot = zeros(nl,1);
    rev_bgt_ytd = zeros(nl,1);
    rev_bgt_mon = zeros(nl,1);
    rev_act_ytd = zeros(nl,1);
    rev_act_mon = zeros(nl,1);
    exp_bgt_tot = zeros(nl,1);
    exp_bgt_ytd = zeros(nl,1);
    exp_bgt_mon = zeros(nl,1);
    exp_act_ytd = zeros(nl,1);
    exp_act_mon = zeros(nl,1);
    
    T = table( ...
        rev_bgt_tot,rev_bgt_ytd,rev_bgt_mon, ...
        rev_act_ytd,rev_act_mon, ...
        exp_bgt_tot,exp_bgt_ytd,exp_bgt_mon, ...
        exp_act_ytd,exp_act_mon, ...
        'RowNames',labels);

    % Find rows that divide rev and exp based on known layout of budget report
    break_indices = find(strcmp(data.textdata(:,1),''));
    rev_start = break_indices(1)+2;
    rev_end   = break_indices(2)-1;
    exp_start = break_indices(4)+2;
    exp_end   = break_indices(5)-1;
   
    % Import all data between rev and exp limits calculated above 
    for i = [rev_start:rev_end,exp_start:exp_end]
        r = data.data(i,:);
        num = [r(7),r(4),r(1),r(5),r(2)];
        if deptMap.isKey(data.dept(i)) % hopefully this will always be true...?
            label = deptMap(data.dept(i));
            if i > rev_end % rev comes before exp, so add in correct table cell
                T{label,6:10} = T{label,6:10} + num;
            else
                T{label,1:5} = T{label,1:5} + num;
            end
        else
            if data.dept(i) ~= 1 % Not Error Account
                disp('Found budget item with unknown department');
                disp(data.dept(i));
            end
        end
    end

    % Calculate additional info off of imported data
    T.net_bgt_tot = T.rev_bgt_tot-T.exp_bgt_tot;
    T.net_bgt_ytd = T.rev_bgt_ytd-T.exp_bgt_ytd;
    T.net_act_ytd = T.rev_act_ytd-T.exp_act_ytd;
    T.net_act_mon = T.rev_act_mon-T.exp_act_mon;
    T.net_act_old = T.net_act_ytd-T.net_act_mon;
    T.mag_bgt_tot = max(abs(T.rev_bgt_tot),abs(T.exp_bgt_tot));
    
    r = 0.05;
    
    % Define 'other' threshold for displaying budget categories
    % for revenue
    TR = T(T.rev_bgt_tot >= max(T.rev_bgt_tot)*r,:);
    TRO = T(T.rev_bgt_tot < max(T.rev_bgt_tot)*r,:);
    TR = sortrows(TR,'rev_bgt_tot');
    TR{'Other',:} = sum(T{T.rev_bgt_tot < max(T.rev_bgt_tot)*r,:},1);
    TR = [TR(end,:);TR(1:end-1,:)];
    TRO = sortrows(TRO,'rev_bgt_tot','descend');
    
    % for expenses
    TE = T(T.exp_bgt_tot >= max(T.exp_bgt_tot)*r,:);
    TEO = T(T.exp_bgt_tot < max(T.exp_bgt_tot)*r,:);
    TE = sortrows(TE,'exp_bgt_tot');
    TE{'Other',:} = sum(T{T.exp_bgt_tot < max(T.exp_bgt_tot)*r,:},1);
    TE = [TE(end,:);TE(1:end-1,:)];
    TEO = sortrows(TEO,'exp_bgt_tot','descend');
   
    % for net revenue
    TN = T(abs(T.mag_bgt_tot) >= abs(max(T.mag_bgt_tot))*r,:);
    TNO = T(abs(T.mag_bgt_tot) < abs(max(T.mag_bgt_tot))*r,:);
    TN{'Other',:} = sum(T{abs(T.mag_bgt_tot) < abs(max(T.mag_bgt_tot))*r/2,:},1);
    TN = sortrows(TN,'net_bgt_tot');
    TN{'Total',:} = sum(T{:,:},1);

    % Draw budgeting figure
    fig = figure(1);
    fig.Color = 'w';
    fig.PaperOrientation = 'portrait';
    fig.Visible = 'off';

    s = 1.3;
    
    clf;
    fig.PaperSize = [8.5 11]*s;
    fig.PaperPosition = [0 0 8.5 11]*s;
    fig.Position = [0 0 8.5 11]*70;
   
    % Plot revenue pie chart 
    axes('Position',[0.75 6 3.75 3.75]/10);
    plotPie(TR.rev_bgt_tot,TR.rev_act_ytd, ...
            TR.rev_bgt_ytd,TR.rev_act_mon, ...
            TR.Properties.RowNames);
   
    % Plot expenses pie chart 
    axes('Position',[5.5 6 3.75 3.75]/10);
    plotPie(TE.exp_bgt_tot,TE.exp_act_ytd, ...
            TE.exp_bgt_ytd,TE.exp_act_mon, ...
            TE.Properties.RowNames);
    
    % Plot net revenue bar graph
    axes('Position',[1.25 4 7.75 2.5]/10);
    plotNetBar(TN.net_bgt_tot,TN.net_bgt_ytd, ...
               TN.net_act_ytd,TN.net_act_old, ...
               TN.rev_act_ytd,TN.exp_act_ytd, ...
               TN.Properties.RowNames);

           
% Transaction Processing

    % Import transaciton data
    data = importdata([filename '-trans.xlsx']);
    dates = x2mdate(data.data(:,1));
    depts = data.textdata(2:end,1);
    accnt = data.textdata(2:end,2);
    dscrp = data.textdata(2:end,6);
    debit = data.data(:,5);
    crdit = data.data(:,6);
    
    n = length(dates);
    good = zeros(n,1) == 1;
    amnt = zeros(n,1);
   
    % For each line, mark as 'good' if can find a valid CO-AC
    % label the amount based on debit or credit
    for i = 1:n
        if ~isnan(dates(i))
            if ~isnan(debit(i)) || ~isnan(crdit(i))
                cll = depts(i);
                str = cll{1};
                dpt = str2double(str(5:7));
                if length(str) >= 7 && deptMap.isKey(dpt)
                    good(i) = 1;
                    if ~isnan(debit(i))
                        amnt(i) = -debit(i);
                    elseif ~isnan(crdit(i))
                        amnt(i) = crdit(i);
                    end
                else
                    if dpt ~= 1 % Not Error account
                        disp('Found transaction item with unknown department');
                        disp(str);
                    end
                end
            end
        end
    end

    % Import data from good cells
    dates = num2cell(dates(good));
    amnt = amnt(good);
    depts = depts(good);
    cobj = depts;
    accnt = accnt(good);
    dscrp = dscrp(good);
    n = length(dates);
    newdept = cell(size(depts));
    
    % Label departments based on internal category
    for i = 1:n
        str = depts{i};
        newdept{i} = deptMap(str2double(str(5:7)));
        depts{i} = str2double(str(5:7));
        cobj{i} = str2double(str(1:3));
        dscrp{i} = strrep(dscrp{i},',','');
        dates{i} = datestr(dates{i});
    end
   
    % Find 15 largest transactions for display
    numtrans = 15;
    
    amntstr = dates;
    TS = table(newdept,depts,cobj,accnt,dates,dscrp,amntstr,amnt);
    TS = sortrows(TS,'amnt');
    TSO = TS(1:numtrans,:);
    
    maxtrans = abs(TSO{numtrans,'amnt'});
    
    TSO = sortrows(TSO,'dates');
    TS = sortrows(TS,'dates');
    for i = 1:n
        TS{i,'amntstr'} = {['$  ' num2str(TS{i,'amnt'},'%4.2f')]};
    end
    for i = 1:numtrans
        TSO{i,'amntstr'} = {['$  ' num2str(TSO{i,'amnt'},'%4.2f')]};
    end
    TS.amnt = [];
    TSO.amnt = [];
   
    % Draw table 
    warning('off','all');
    columnname =   {'Dept','Acct','Date','Description','Amount'};
    columnformat = {'char','char','char','char','char'}; 
    uitable('Units','normalized', ...
        'Position',[1 0.5 8 3.1]/10, ...
    	'FontSize',10,'Data', table2cell(TSO(:,[1,4:end])),... 
        'ColumnWidth',{60 90 60 282 60}, ...
        'ColumnName', columnname,...
    	'ColumnFormat', columnformat,...
        'RowName',[],'RowStriping','off'); 
    
    axes('Position',[0 0 1 1]);
    axis off;
    text(0.5,0.97, ...
        ['OrigamiUSA Budget Report ' filename], ...
        'FontSize',14,'FontWeight','bold', ...
        'HorizontalAlignment', 'Center', ...
        'VerticalAlignment', 'Top' );
    text(.1,0.94, ...
        {'Revenue', ...
        ['$[' num2str(round(TN{'Total','rev_act_mon'}/1000)) ',' ...
        	num2str(round(TN{'Total','rev_act_ytd'}/1000)) ',' ...
            num2str(round(TN{'Total','rev_bgt_ytd'}/1000)) ',' ...
        	num2str(round(TN{'Total','rev_bgt_tot'}/1000)) ']K']}, ...
        'FontSize',14,'FontWeight','bold', ...
        'HorizontalAlignment', 'Center', ...
        'VerticalAlignment', 'Top' );
    text(.9,0.94, ...
        {'Expenses', ...
        ['$[' num2str(round(TN{'Total','exp_act_mon'}/1000)) ',' ...
        	num2str(round(TN{'Total','exp_act_ytd'}/1000)) ',' ...
            num2str(round(TN{'Total','exp_bgt_ytd'}/1000)) ',' ...
        	num2str(round(TN{'Total','exp_bgt_tot'}/1000)) ']K']}, ...        
        'FontSize',14,'FontWeight','bold', ...
        'HorizontalAlignment', 'Center', ...
        'VerticalAlignment', 'Top' );
    text(0.5,0.68, ...
        {'Net Income', ...
        ['$[' num2str(round(TN{'Total','net_act_mon'}/1000)) ',' ...
        	num2str(round(TN{'Total','net_act_ytd'}/1000)) ',' ...
            num2str(round(TN{'Total','net_bgt_ytd'}/1000)) ',' ...
        	num2str(round(TN{'Total','net_bgt_tot'}/1000)) ']K']}, ...
        'FontSize',14,'FontWeight','bold', ...
        'HorizontalAlignment', 'Center', ...
        'VerticalAlignment', 'Top' );
    text(0.5,0.92, ...
        '$[ mon-act , ytd-act , ytd-bgt , tot-bgt ]K', ...
        'FontSize',12, ...
        'HorizontalAlignment', 'Center', ...
        'VerticalAlignment', 'Top' );
    text(0.5,0.38, ...
        ['15 Largest Transactions (mag > $' num2str(maxtrans,'%10.0f') ')'], ...
        'FontSize',14,'FontWeight','bold', ...
        'HorizontalAlignment', 'Center', ...
        'VerticalAlignment', 'Top' );
    % oth = TRO.Properties.RowNames;
    % oth = {'Rev Other' oth{1:end}};
    % text(.05,0.78, ...
    %     oth, ...
    %     'FontSize',8, ...
    %     'HorizontalAlignment', 'Left', ...
    %     'VerticalAlignment', 'Top' );
    % oth = TEO.Properties.RowNames;
    % oth = {'Exp Other' oth{1:end}};
    % text(.9,0.78, ...
    %     oth, ...
    %     'FontSize',8, ...
    %     'HorizontalAlignment', 'Left', ...
    %     'VerticalAlignment', 'Top' );
    % oth = TNO.Properties.RowNames;
    % oth = {'Net Other' oth{1:end}};
    % text(.9,0.5, ...
    %     oth, ...
    %     'FontSize',8, ...
    %     'HorizontalAlignment', 'Left', ...
    %     'VerticalAlignment', 'Top' );
    
  	saveas(fig,['figs/' filename '.pdf']);
    close(fig);

    % Convert table cells to strings
    rev_bgt_tot = cellstr(num2str(T.rev_bgt_tot,'$ %10.0f'));
    rev_bgt_ytd = cellstr(num2str(T.rev_bgt_ytd,'$ %10.0f'));
    rev_bgt_mon = cellstr(num2str(T.rev_bgt_mon,'$ %10.0f'));
    rev_act_ytd = cellstr(num2str(T.rev_act_ytd,'$ %10.0f'));
    rev_act_mon = cellstr(num2str(T.rev_act_mon,'$ %10.0f'));
    exp_bgt_tot = cellstr(num2str(T.exp_bgt_tot,'$ %10.0f'));
    exp_bgt_ytd = cellstr(num2str(T.exp_bgt_ytd,'$ %10.0f'));
    exp_bgt_mon = cellstr(num2str(T.exp_bgt_mon,'$ %10.0f'));
    exp_act_ytd = cellstr(num2str(T.exp_act_ytd,'$ %10.0f'));
    exp_act_mon = cellstr(num2str(T.exp_act_mon,'$ %10.0f'));
    net_bgt_tot = cellstr(num2str(T.net_bgt_tot,'$ %10.0f'));
    net_bgt_ytd = cellstr(num2str(T.net_bgt_ytd,'$ %10.0f'));
    net_act_ytd = cellstr(num2str(T.net_act_ytd,'$ %10.0f'));
    net_act_mon = cellstr(num2str(T.net_act_mon,'$ %10.0f'));
    net_act_old = cellstr(num2str(T.net_act_old,'$ %10.0f'));
    mag_bgt_tot = cellstr(num2str(T.mag_bgt_tot,'$ %10.0f'));
    
    Tstr = table( ...
        rev_bgt_tot,rev_bgt_ytd,rev_bgt_mon, ...
        rev_act_ytd,rev_act_mon, ...
        exp_bgt_tot,exp_bgt_ytd,exp_bgt_mon, ...
        exp_act_ytd,exp_act_mon,net_bgt_tot, ...
        net_bgt_ytd,net_act_ytd,net_act_mon, ...
        net_act_old, mag_bgt_tot, ...
        'RowNames',labels);
    
    datafile = ['dat/' filename '-ku_Tdata.csv'];
    writetable(Tstr,datafile,'WriteRowNames',true);
    
    datafile = ['dat/' filename '-ku_trans.csv'];
    writetable(TS,datafile);
    warning('on','all');
end
end

function [] = plotPie(tot,ytd,bytd,mon,labels)

    tot = tot/1000;
    ytd = ytd/1000;
    bytd = bytd/1000;
    mon = mon/1000;
    
    total = sum(tot);
    per = tot/total;
    angle = per*2*pi;
    sumangle = cumsum([0;angle]);
    
    perytd = (ytd./tot).^0.5;
    perbytd = (bytd./tot).^0.5;
    permon = ((ytd-mon)./tot).^0.5;
    
    n = 100;
    m = length(tot);
    colors = winter(m);
    
    hold on;
    for i = 1:m
        angs = (0:n)/n*angle(i)+sumangle(i);
        x = cos(angs);
        y = sin(angs);
        fill([0 x 0],[0 y 0],1-(1-colors(i,:))*0.3, ...
            'EdgeColor',[1 1 1]*0.7);
        fill([0 x*perbytd(i) 0], ...
             [0 y*perbytd(i) 0], ...
            1-(1-colors(i,:))*0.8,'EdgeColor',[1 1 1]*0.7);
        plot(x*perbytd(i),y*perbytd(i),'k');
        cent = sumangle(i)+angle(i)/2;
        text(cos(cent)*1.5,sin(cent)*1.2, ...
            {[labels{i} ' ' num2str(floor(per(i)*100)) '%'], ...
            ['$[' num2str(round(mon(i))) ',' ...
            num2str(round(ytd(i))) ',' ...
            num2str(round(bytd(i))) ',' ...
            num2str(round(tot(i))) ']K']}, ...
            'FontSize',9, ...
            'HorizontalAlignment','center', ...
            'VerticalAlignment','middle');
    end
    for i = 1:m
        angs = (0:n)/n*angle(i)+sumangle(i);
        x = cos(angs);
        y = sin(angs);
        plot(x*permon(i),y*permon(i), ...
              'r:','LineWidth',1);
        plot(x*perytd(i),y*perytd(i), ...
              'r','LineWidth',1.5);
    end
    axis off;
    axis([-1.5,1.5,-1.5,1.5]);
    axis equal;
end

function [] = plotNetBar(tot,bgt,ytd,old,revytd,expytd,labels) 
    tot = tot/1000;
    bgt = bgt/1000;
    ytd = ytd/1000;
    old = old/1000;
    revytd = revytd/1000;
    expytd = expytd/1000;
    
    n = length(tot);
    colors = winter(n);
    
    hold on;
    for i = 1:n
        x1 = (i-1)*10+1;
        x2 = x1+2;
        x3 = x1+6;
        x4 = x1+8;
        y1 = 0;
        y2 = tot(i);
        fill([x1 x1 x4 x4 x1], ...
             [y1 y2 y2 y1 y1], ...
             1-(1-colors(i,:))*0.3, ...
            'EdgeColor',[1 1 1]*0.7);
        y2 = bgt(i);
        fill([x2 x2 x3 x3 x2], ...
             [y1 y2 y2 y1 y1], ...
             1-(1-colors(i,:))*0.8, ...
            'EdgeColor',[1 1 1]*0.7);
        plot([x1 x4],[y2 y2],'k');
        y1 = old(i);
        y2 = ytd(i);
        plot([x1 x4],[y1 y1],'r:','LineWidth',1);
        plot([x1 x4],[y2 y2],'r','LineWidth',1.5);
        x = (x1+x4)/2;
        y = 110*0.5;
        if tot(i) > 0
            y = -y;
        end
        text(x,y,{labels{i}, ...
            ['$[' num2str(round(revytd(i))) ...
            '-' num2str(round(expytd(i))) ']K'], ...
            ['$' num2str(round(ytd(i))) 'K']}, ...
            'FontSize',9, ...
            'HorizontalAlignment','center', ...
            'VerticalAlignment','middle');
    end
    axis([0,10*n,-110,110]);
    ax = gca;
    ax.XAxis.Visible = 'off';
    ax.YGrid = 'on';
    ax.YLabel.String = 'Dollars ($ x1000)';
end





















